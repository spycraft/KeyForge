#!/bin/bash

echo "🚀 开始构建 KeyForge 前端架构..."

# 1. 创建必要的目录
mkdir -p src/utils src/composables src/components
echo "📂 目录结构创建完毕: src/utils, src/composables, src/components"

# 2. 写入 audioEngine.ts
cat << 'EOF' > src/utils/audioEngine.ts
const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
const audioCtx = new AudioContextClass();

export const AudioEngine = {
  resume() {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  },

  playTypingSound(isCorrect: boolean) {
    this.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (isCorrect) {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      oscillator.start(now);
      oscillator.stop(now + 0.05);
    } else {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gainNode.gain.setValueAtTime(0.6, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    }
  }
};
EOF
echo "📄 已生成: src/utils/audioEngine.ts"

# 3. 写入 ttsEngine.ts
cat << 'EOF' > src/utils/ttsEngine.ts
const synth = window.speechSynthesis;

export const TTSEngine = {
  speak(text: string) {
    if (synth.speaking) {
      synth.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;

    const voices = synth.getVoices();
    const bestVoice = voices.find(v => v.name === 'Samantha' || v.name === 'Alex');
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    synth.speak(utterance);
  }
};
EOF
echo "📄 已生成: src/utils/ttsEngine.ts"

# 4. 写入 useTyping.ts
cat << 'EOF' > src/composables/useTyping.ts
import { ref, computed } from 'vue';
import { AudioEngine } from '../utils/audioEngine';

export function useTyping(initialSentence: string) {
  const targetSentence = ref(initialSentence);
  const userInput = ref('');
  const incorrectIndices = ref<Set<number>>(new Set());

  const targetChars = computed(() => targetSentence.value.split(''));
  const currentIndex = computed(() => userInput.value.length);
  const isFinished = computed(() => userInput.value.length >= targetSentence.value.length);

  function handleInput(e: Event) {
    const inputEvent = e as InputEvent;
    const inputElement = e.target as HTMLInputElement;
    
    const oldLen = userInput.value.length;
    const newLen = inputElement.value.length;
    userInput.value = inputElement.value;

    incorrectIndices.value.clear();
    for (let i = 0; i < userInput.value.length; i++) {
      if (userInput.value[i] !== targetChars.value[i]) {
        incorrectIndices.value.add(i);
      }
    }

    if (inputEvent.inputType !== 'deleteContentBackward' && newLen > oldLen) {
      const lastIdx = newLen - 1;
      const isCorrect = userInput.value[lastIdx] === targetChars.value[lastIdx];
      AudioEngine.playTypingSound(isCorrect);
    }
  }

  function setSentence(newSentence: string) {
    targetSentence.value = newSentence;
    userInput.value = '';
    incorrectIndices.value.clear();
  }

  return {
    targetSentence,
    userInput,
    incorrectIndices,
    targetChars,
    currentIndex,
    isFinished,
    handleInput,
    setSentence
  };
}
EOF
echo "📄 已生成: src/composables/useTyping.ts"

# 5. 写入 TypingBoard.vue
cat << 'EOF' > src/components/TypingBoard.vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTyping } from '../composables/useTyping';
import { TTSEngine } from '../utils/ttsEngine';

const { 
  targetSentence, userInput, targetChars, currentIndex, 
  incorrectIndices, isFinished, handleInput 
} = useTyping('Welcome to KeyForge. Focus on each keystroke.');

const inputRef = ref<HTMLInputElement | null>(null);

function focusInput() {
  if (!isFinished.value) inputRef.value?.focus();
}

function playTTS() {
  TTSEngine.speak(targetSentence.value);
}

onMounted(() => {
  focusInput();
});
</script>

<template>
  <div class="board-container" @click="focusInput">
    <div class="controls">
      <button class="geek-btn" @click.stop="playTTS" title="快捷键: Tab">🔊 听发音 (Tab)</button>
    </div>

    <div class="typing-area">
      <div class="target-display">
        <span 
          v-for="(char, index) in targetChars" :key="index"
          class="char-item"
          :class="{
            'correct': index < currentIndex && !incorrectIndices.has(index),
            'incorrect': incorrectIndices.has(index),                      
            'current-cursor': index === currentIndex,                          
            'upcoming': index > currentIndex                                   
          }"
        >{{ char }}</span>
      </div>

      <input 
        type="text" 
        class="hidden-input"
        :value="userInput"
        @input="handleInput"
        @keydown.tab.prevent="playTTS" 
        ref="inputRef"
        :disabled="isFinished"
      />
      
      <div v-if="isFinished" class="overlay">
        <h2>锻造完成！</h2>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-container { width: 100%; display: flex; flex-direction: column; align-items: center; }
.controls { width: 80%; max-width: 800px; display: flex; margin-bottom: 1rem; }
.geek-btn { background: transparent; border: 1px solid #45475a; color: #a6adc8; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s ease; }
.geek-btn:hover { background: #313244; color: #cdd6f4; border-color: #89b4fa; }
.typing-area { position: relative; width: 80%; max-width: 800px; background: rgba(49, 50, 68, 0.5); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
.target-display { font-size: 1.8rem; line-height: 1.8; white-space: pre-wrap; word-break: break-word; letter-spacing: -0.05em; }
.char-item { display: inline-block; transition: all 0.1s; }
.char-item:empty::before, .char-item:contains(' ') { content: ' '; white-space: pre; }
.correct { color: #a6e3a1; }        
.incorrect { background-color: #f38ba8; color: #1e1e2e; border-radius: 2px; } 
.upcoming { color: #6c7086; }        
.current-cursor { border-left: 2px solid #f9e2af; margin-left: -2px; padding-left: 2px; color: #cdd6f4; }
.hidden-input { position: absolute; opacity: 0; width: 1px; height: 1px; border: none; }
.overlay { position: absolute; inset: 0; background: rgba(30,30,46,0.95); display: flex; align-items: center; justify-content: center; border-radius: 12px; animation: fadeIn 0.3s ease-out forwards; }
.overlay h2 { color: #a6e3a1; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
EOF
echo "📄 已生成: src/components/TypingBoard.vue"

# 6. 覆写 App.vue
cat << 'EOF' > src/App.vue
<script setup lang="ts">
import TypingBoard from './components/TypingBoard.vue';
</script>

<template>
  <main class="app-layout">
    <header class="header">
      <h1>KeyForge</h1>
      <p>锻造你的词汇肌肉记忆</p>
    </header>
    
    <TypingBoard />
  </main>
</template>

<style>
body { margin: 0; padding: 0; background-color: #1e1e2e; }
.app-layout { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; color: #cdd6f4; font-family: 'JetBrains Mono', monospace, sans-serif; }
.header { text-align: center; margin-bottom: 2rem; }
.header h1 { font-size: 3rem; margin-bottom: 0.5rem; color: #b4befe; }
</style>
EOF
echo "📄 已覆写: src/App.vue"

echo ""
echo "🎉 所有前端文件重构完毕！"
echo "👉 请回到你的 Tauri 窗口，应该已经自动热更新了。快敲击两下试试手感吧！"
