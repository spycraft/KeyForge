# Debug Session: input-tts-broken

## Status: [FIXED - awaiting user verification]

## Symptoms
1. Input functionality completely broken - users cannot type
2. Chinese TTS completely non-functional - no Chinese audio output

## Hypotheses & Evidence

### H1: Hidden input not focusable in Tauri WKWebView [CONFIRMED - root cause]
- `pointer-events: none` + `width: 0; height: 0;` made the input element unfocusable in Tauri's WKWebView
- Once focus was lost (e.g., after clicking a TTS button), `hiddenInput.value?.focus()` could not regain it
- Without focus, `@input` events never fired, making typing impossible

### H2: handleInput logic desync bug [CONFIRMED - secondary cause]
- When `newChar === undefined` (target.value.length <= previousLength), code didn't reset `target.value`
- Once desynced, all subsequent `target.value[previousLength]` returned undefined, permanently breaking input

### H3: Browser speechSynthesis unavailable in Tauri WKWebView [CONFIRMED - root cause for Chinese TTS]
- `speakChinese` bypassed Edge TTS and used `window.speechSynthesis` directly
- In Tauri WKWebView, `speechSynthesis` either has no Chinese voices or doesn't produce sound
- The Rust backend already supported Chinese (`zh-CN-XiaoxiaoNeural`) but was never used for Chinese

### H4: Edge TTS Rust backend not recompiled [REJECTED]
- `cargo check` confirmed the Chinese detection code compiles correctly
- `npm run tauri dev` recompiles Rust automatically

### H5: Global keydown handler swallowed letter keys [CONFIRMED - contributing factor]
- `handleGlobalKey` only handled space/Enter/arrows/T, ignored all letter keys
- When hidden input lost focus, letter keys were swallowed with no effect

## Fix Summary

### Fix 1: Replaced hidden input with global keydown handler
- Removed `<input>` element, `hiddenInput` ref, `handleInput`, `handleKeyDown`
- Added `handleTypeChar(char)` function that processes typed characters directly
- Updated `handleGlobalKey` to capture all printable characters (`e.key.length === 1`) and Backspace
- No focus dependency — typing works regardless of which element has focus

### Fix 2: Chinese TTS now uses Edge TTS
- Changed `speakChinese()` to call `speak()` instead of `_speakBrowser()`
- Chinese text goes through Edge TTS Rust backend → `zh-CN-XiaoxiaoNeural` voice
- Falls back to browser TTS only if Edge TTS fails

### Fix 3: Added timeout protection on speak() Promise
- 30-second timeout on `audio.onended` Promise — prevents permanent hang
- Added `audio.onerror` handler for proper error recovery
- Reduced prefetch timeout from 10s to 5s for faster fallback

## Files Changed
- `src/views/PracticeView.vue` — removed hidden input, rewrote typing logic
- `src/utils/edgeTtsEngine.ts` — `speakChinese` now uses Edge TTS, added timeout/error handlers
