// Tauri 环境检测 (Tauri v2 使用 __TAURI_INTERNALS__)
const isTauri = () => '__TAURI_INTERNALS__' in window

// 懒加载 Tauri invoke，避免浏览器环境下导入报错
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null
async function getInvoke() {
  if (tauriInvoke) return tauriInvoke
  try {
    const mod = await import('@tauri-apps/api/core')
    tauriInvoke = mod.invoke
    return tauriInvoke
  } catch {
    return null
  }
}

export const EdgeTTSEngine = {
  audio: null as HTMLAudioElement | null,
  isPlaying: false,
  // 当前播放的 Promise，用于排队等待
  currentPlayback: null as Promise<boolean> | null,

  // 多文本缓存：text -> { url, promise }
  cache: new Map<string, { url: string; promise: Promise<void> | null }>(),
  // 限制缓存大小，避免内存泄漏
  _cacheOrder: [] as string[],

  // 等待当前播放完成
  async waitUntilDone() {
    if (this.currentPlayback) {
      await this.currentPlayback
    }
  },

  // 浏览器原生 TTS 回退
  _utterance: null as SpeechSynthesisUtterance | null,

  _trimCache() {
    const MAX = 20
    while (this._cacheOrder.length > MAX) {
      const old = this._cacheOrder.shift()
      if (old) {
        const entry = this.cache.get(old)
        if (entry?.url) URL.revokeObjectURL(entry.url)
        this.cache.delete(old)
      }
    }
  },

  async prefetch(text: string) {
    const existing = this.cache.get(text)
    if (existing?.url) {
      console.log(`✓ [TTS] 缓存命中: "${text.substring(0, 20)}"`)
      return
    }
    if (existing?.promise) {
      console.log(`⏳ [TTS] 预加载在途，复用: "${text.substring(0, 20)}"`)
      return existing.promise
    }

    // 非 Tauri 环境：浏览器原生 TTS 不需要预加载
    if (!isTauri()) {
      console.log(`ℹ️ [TTS] 非 Tauri 环境，跳过预加载`)
      return
    }

    console.log(`⏳ [TTS] 开始预加载: "${text.substring(0, 30)}"`)

    const promise = (async () => {
      try {
        const invoke = await getInvoke()
        if (!invoke) return

        // 15 秒超时
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('TTS 请求超时')), 15000)
        })

        const rawData: number[] = await Promise.race([
          invoke('generate_edge_tts', { text }) as Promise<number[]>,
          timeoutPromise
        ]) as number[]

        const uint8Array = new Uint8Array(rawData)
        const blob = new Blob([uint8Array], { type: 'audio/mp3' })
        const url = URL.createObjectURL(blob)

        const entry = this.cache.get(text) || { url: '', promise: null }
        entry.url = url
        entry.promise = null
        this.cache.set(text, entry)
        this._cacheOrder.push(text)
        this._trimCache()
        console.log(`✅ [TTS] 预加载就绪: "${text.substring(0, 20)}"`)
      } catch (error) {
        console.error('❌ [TTS] 预加载失败:', error)
        const entry = this.cache.get(text)
        if (entry) entry.promise = null
      }
    })()

    this.cache.set(text, { url: '', promise })
    return promise
  },

  async speak(text: string) {
    // 非 Tauri 环境：使用浏览器原生 SpeechSynthesis
    if (!isTauri()) {
      return this._speakBrowser(text)
    }

    // Tauri 环境：使用 Edge TTS
    if (!this.audio) {
      this.audio = new Audio()
    }

    if (this.isPlaying) {
      this.audio.pause()
      this.audio.currentTime = 0
    }

    const entry = this.cache.get(text)
    if (!entry?.url) {
      // 未缓存，等待预加载完成
      if (entry?.promise) {
        await entry.promise
      } else {
        await this.prefetch(text)
      }
    }

    const cached = this.cache.get(text)
    if (!cached?.url) {
      console.warn('⚠️ [TTS] Edge TTS 预加载失败，回退到浏览器 TTS:', text.substring(0, 30))
      return this._speakBrowser(text)
    }

    console.log(`▶️ [TTS] 播放: "${text.substring(0, 30)}"`)
    this.isPlaying = true
    this.audio.src = cached.url

    try {
      await this.audio.play()
      console.log('▶️ [TTS] 缓存秒播成功！')
    } catch (e) {
      console.error('❌ [TTS] 播放失败:', e)
      this.isPlaying = false
      return this._speakBrowser(text)
    }

    return this.currentPlayback = new Promise((resolve) => {
      // 超时保护：最多等待 30 秒，防止 onended 不触发
      const timeout = setTimeout(() => {
        this.isPlaying = false
        this.currentPlayback = null
        resolve(true)
      }, 30000)

      this.audio!.onended = () => {
        clearTimeout(timeout)
        this.isPlaying = false
        this.currentPlayback = null
        resolve(true)
      }
      this.audio!.onerror = () => {
        clearTimeout(timeout)
        this.isPlaying = false
        this.currentPlayback = null
        resolve(false)
      }
    })
  },

  // 中文朗读：使用 Edge TTS（Rust 后端已支持中文语音）
  speakChinese(text: string) {
    return this.speak(text)
  },

  // 浏览器原生 TTS 回退方案
  _speakBrowser(text: string): Promise<boolean> {
    return this.currentPlayback = new Promise((resolve) => {
      if (!window.speechSynthesis) {
        console.warn('⚠️ [TTS] 浏览器不支持 SpeechSynthesis')
        this.currentPlayback = null
        resolve(false)
        return
      }

      // 确保 voices 已加载（带超时保护）
      const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
        return new Promise((resolve) => {
          const voices = window.speechSynthesis.getVoices()
          if (voices.length > 0) {
            resolve(voices)
            return
          }
          // 3 秒超时，防止 onvoiceschanged 不触发
          const timer = setTimeout(() => {
            resolve(window.speechSynthesis.getVoices())
          }, 3000)
          window.speechSynthesis.onvoiceschanged = () => {
            clearTimeout(timer)
            resolve(window.speechSynthesis.getVoices())
          }
        })
      }

      // 检测是否为中文文本
      const isChinese = /[\u4e00-\u9fff]/.test(text)

      getVoices().then((voices) => {
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)

        if (isChinese) {
          utterance.lang = 'zh-CN'
          utterance.rate = 0.9
          utterance.pitch = 1.1
          utterance.volume = 1

          // 优先选择高质量中文女声
          const preferredChineseVoices = [
            'Ting-Ting',    // macOS 中文女声
            'Sin-ji',       // macOS 粤语女声
            'Mei-Jia',      // macOS 台湾女声
            'Google 普通话（中国大陆）',
            'Google 中文',
            'Microsoft Huihui - Chinese (Simplified, PRC)',
            'Microsoft Yaoyao - Chinese (Simplified, PRC)',
            'Microsoft Yaoyao',
          ]

          let selectedVoice: SpeechSynthesisVoice | null = null

          for (const name of preferredChineseVoices) {
            selectedVoice = voices.find(v =>
              v.lang.startsWith('zh') && (
                v.name === name ||
                v.name.toLowerCase().includes(name.toLowerCase())
              )
            ) ?? null
            if (selectedVoice) break
          }

          if (!selectedVoice) {
            selectedVoice = voices.find(v =>
              v.lang.startsWith('zh') &&
              (v.name.toLowerCase().includes('female') ||
               v.name.toLowerCase().includes('woman'))
            ) ?? null
          }

          if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('zh')) ?? null
          }

          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log(`🎤 [TTS] 使用中文语音: ${selectedVoice.name} (${selectedVoice.lang})`)
          }
        } else {
          utterance.lang = 'en-US'
          utterance.rate = 0.85
          utterance.pitch = 1.1
          utterance.volume = 1

          // 优先选择高质量女声语音
          const preferredVoices = [
            'Samantha',
            'Serena',
            'Alex',
            'Zira',
            'Hazel',
            'Google US English',
            'Google UK English Female',
            'Microsoft Zira - English (United States)',
          ]

          let selectedVoice: SpeechSynthesisVoice | null = null

          for (const name of preferredVoices) {
            selectedVoice = voices.find(v =>
              v.name === name ||
              v.name.toLowerCase().includes(name.toLowerCase())
            ) ?? null
            if (selectedVoice) break
          }

          if (!selectedVoice) {
            selectedVoice = voices.find(v =>
              v.lang.startsWith('en') &&
              (v.name.toLowerCase().includes('female') ||
               v.name.toLowerCase().includes('woman') ||
               v.name.toLowerCase().includes('girl'))
            ) ?? null
          }

          if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang.startsWith('en')) ?? null
          }

          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log(`🎤 [TTS] 使用语音: ${selectedVoice.name} (${selectedVoice.lang})`)
          }
        }

        utterance.onend = () => {
          this.isPlaying = false
          this.currentPlayback = null
          resolve(true)
        }
        utterance.onerror = () => {
          this.isPlaying = false
          this.currentPlayback = null
          resolve(false)
        }

        this.isPlaying = true
        window.speechSynthesis.speak(utterance)
      })
    })
  },
}
