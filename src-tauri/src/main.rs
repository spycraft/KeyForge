// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use uuid::Uuid;
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};

const TRUSTED_CLIENT_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH: u64 = 11644473600;
const CHROMIUM_FULL_VERSION: &str = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION: &str = "143";

/// 生成 Sec-MS-GEC token，算法与官方 edge-tts Python 库 drm.py 完全一致
fn generate_sec_ms_gec() -> String {
    // 1. 获取当前 Unix 秒级时间戳
    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // 2. 转换为 Windows file time epoch (1601-01-01)
    let mut ticks: u64 = now_secs + WIN_EPOCH;

    // 3. 向下取整到最近的 5 分钟 (300 秒)
    ticks -= ticks % 300;

    // 4. 转换为 100 纳秒间隔 (乘以 10_000_000)
    ticks *= 10_000_000;

    // 5. 拼接 ticks + TRUSTED_CLIENT_TOKEN 后做 SHA-256
    let str_to_hash = format!("{}{}", ticks, TRUSTED_CLIENT_TOKEN);
    let mut hasher = Sha256::new();
    hasher.update(str_to_hash.as_bytes());
    format!("{:X}", hasher.finalize())
}

/// 生成随机 MUID (32 位大写十六进制)
fn generate_muid() -> String {
    Uuid::new_v4().to_string().replace("-", "").to_uppercase()
}

#[tauri::command]
async fn generate_edge_tts(text: String) -> Result<Vec<u8>, String> {
    let sec_ms_gec = generate_sec_ms_gec();
    let muid = generate_muid();

    // 构造 WebSocket URL（Sec-MS-GEC 同时放入 URL 参数和请求头）
    let connection_id = Uuid::new_v4().to_string().replace("-", "");
    let url = format!(
        "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken={}&Sec-MS-GEC={}&Sec-MS-GEC-Version=1-{}&ConnectionId={}",
        TRUSTED_CLIENT_TOKEN, sec_ms_gec, CHROMIUM_FULL_VERSION, connection_id
    );

    let mut request = url.into_client_request().map_err(|e| e.to_string())?;
    let headers = request.headers_mut();

    // 完整请求头，与官方 edge-tts constants.py WSS_HEADERS 一致
    headers.insert("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold".parse().unwrap());
    headers.insert("User-Agent", format!(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{}.0.0.0 Safari/537.36 Edg/{}.0.0.0",
        CHROMIUM_MAJOR_VERSION, CHROMIUM_MAJOR_VERSION
    ).parse().unwrap());
    headers.insert("Pragma", "no-cache".parse().unwrap());
    headers.insert("Cache-Control", "no-cache".parse().unwrap());
    headers.insert("Sec-WebSocket-Version", "13".parse().unwrap());
    headers.insert("Accept-Encoding", "gzip, deflate, br, zstd".parse().unwrap());
    headers.insert("Accept-Language", "en-US,en;q=0.9".parse().unwrap());
    headers.insert("Sec-MS-GEC", sec_ms_gec.parse().unwrap());
    headers.insert("Sec-MS-GEC-Version", format!("1-{}", CHROMIUM_FULL_VERSION).parse().unwrap());
    headers.insert("Cookie", format!("muid={}", muid).parse().unwrap());

    // 建立 WebSocket 连接
    let (mut ws_stream, _) = connect_async(request).await.map_err(|e| format!("WebSocket 握手失败: {}", e))?;

    let config = r#"{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}"#;
    let msg1 = format!("Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{}", config);
    ws_stream.send(Message::Text(msg1.into())).await.map_err(|e| e.to_string())?;

    let request_id = Uuid::new_v4().to_string().replace("-", "");

    // 检测文本语言，选择对应语音
    let is_chinese = text.chars().any(|c| ('\u{4e00}'..='\u{9fff}').contains(&c));
    let (voice_name, lang) = if is_chinese {
        ("zh-CN-XiaoxiaoNeural", "zh-CN")
    } else {
        ("en-US-JennyNeural", "en-US")
    };

    eprintln!("[TTS] 语言: {} | 语音: {} | 文本长度: {}", lang, voice_name, text.chars().count());

    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{}'><voice name='{}'><prosody rate='-10%'>{}</prosody></voice></speak>",
        lang, voice_name, text
    );
    let msg2 = format!("X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n{}", request_id, ssml);
    ws_stream.send(Message::Text(msg2.into())).await.map_err(|e| e.to_string())?;

    let mut audio_bytes = Vec::new();

    while let Some(msg) = ws_stream.next().await {
        let msg = msg.map_err(|e| e.to_string())?;
        match msg {
            Message::Text(text) => {
                if text.contains("Path:turn.end") {
                    break;
                }
            }
            Message::Binary(bin) => {
                // 剥离二进制块头部的文本 Header
                let mut header_end = 0;
                for i in 0..bin.len().saturating_sub(3) {
                    if bin[i] == 13 && bin[i+1] == 10 && bin[i+2] == 13 && bin[i+3] == 10 {
                        header_end = i + 4;
                        break;
                    }
                }
                audio_bytes.extend_from_slice(&bin[header_end..]);
            }
            _ => {}
        }
    }

    if audio_bytes.is_empty() {
        eprintln!("[TTS] ❌ 未返回任何音频数据");
        return Err("微软服务器未返回任何音频数据".into());
    }

    eprintln!("[TTS] ✅ 音频数据: {} 字节", audio_bytes.len());
    Ok(audio_bytes)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_edge_tts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
