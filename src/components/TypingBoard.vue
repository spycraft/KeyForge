<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useTyping } from '../composables/useTyping';
import { EdgeTTSEngine } from '../utils/edgeTtsEngine';
import { AmbientEngine } from '../utils/ambientEngine';

const { 
  targetSentence, userInput, targetChars, currentIndex, 
  incorrectIndices, isFinished, handleInput 
} = useTyping('Welcome to KeyForge. Focus on each keystroke.');

const inputRef = ref<HTMLInputElement | null>(null);

// --- 白噪音环境音控制 ---
const ambientOptions = [
  { label: '静音 (Mute)', value: '' },
  { label: '🌲 树林 (Forest)', value: '/sounds/forest.mp3' },
  { label: '🌧️ 下雨 (Rain)', value: '/sounds/rain.mp3' },
  { label: '🌊 海边 (Sea)', value: '/sounds/sea.mp3' },
  { label: '🦗 夏夜 (Summer Night)', value: '/sounds/summer_night.mp3' },
];
const selectedAmbient = ref('');

// 监听用户选择变化，调用独立的环境音引擎
watch(selectedAmbient, (newPath) => {
  if (!newPath) {
    AmbientEngine.stop();
  } else {
    // 补全路径，确保资源能被正确加载
    // 注意：这里的路径是相对 public 目录的，实际开发中如果音频放在其他地方需要调整
    const fullPath = new URL(newPath, window.location.origin).href;
    AmbientEngine.play(fullPath);
  }
  focusInput(); // 切换音效后自动把焦点还给打字区
});

function focusInput() {
  if (!isFinished.value) inputRef.value?.focus();
}

function playTTS() {
  // 换上了搭载微软 V8 引擎的发音器
  EdgeTTSEngine.speak(targetSentence.value);
  focusInput();
}

onMounted(() => {
  focusInput();
  EdgeTTSEngine.prefetch(targetSentence.value);
});
</script>

<template>
  <div class="board-container" @click="focusInput">
    <div class="controls">
      <button class="geek-btn" @click.stop="playTTS" title="快捷键: Tab">🔊 听发音 (Tab)</button>
      
      <div class="ambient-select-wrapper" @click.stop>
        <label for="ambient-select" class="ambient-label">环境音:</label>
        <select id="ambient-select" v-model="selectedAmbient" class="geek-select">
          <option v-for="opt in ambientOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
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
.board-container { width: 100%; display: flex; flex-direction: column; align-items: center; position: relative; }

/* 控制栏布局调整，两端对齐 */
.controls { 
  width: 80%; 
  max-width: 800px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  margin-bottom: 1rem; 
}

.geek-btn { background: transparent; border: 1px solid #45475a; color: #a6adc8; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; font-family: inherit;}
.geek-btn:hover { background: #313244; color: #cdd6f4; border-color: #89b4fa; }

/* 下拉菜单样式 */
.ambient-select-wrapper { display: flex; align-items: center; gap: 8px; }
.ambient-label { color: #a6adc8; font-size: 0.9rem; }
.geek-select {
  background-color: transparent;
  color: #a6adc8;
  border: 1px solid #45475a;
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none; /* 移除默认下拉箭头，在某些系统上更好看 */
}
.geek-select:hover { border-color: #89b4fa; color: #cdd6f4; }
.geek-select option { background-color: #1e1e2e; color: #cdd6f4; } /* 修复下拉列表选项颜色 */

/* 核心打字区样式（与之前一致） */
.typing-area { position: relative; width: 80%; max-width: 800px; background: rgba(49, 50, 68, 0.5); padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
.target-display { font-size: 1.8rem; line-height: 1.8; white-space: pre-wrap; word-break: break-word; letter-spacing: -0.05em; }
.char-item { display: inline-block; transition: all 0.1s; }
.char-item:empty::before, .char-item:contains(' ') { content: ' '; white-space: pre; }
.correct { color: #a6e3a1; }        
.incorrect { background-color: #f38ba8; color: #1e1e2e; border-radius: 2px; } 
.upcoming { color: #6c7086; }        
.current-cursor { border-left: 2px solid #f9e2af; margin-left: -2px; padding-left: 2px; color: #cdd6f4; }
.hidden-input { position: absolute; opacity: 0; width: 1px; height: 1px; border: none; }
.overlay { position: absolute; inset: 0; background: rgba(30,30,46,0.95); display: flex; align-items: center; justify-content: center; border-radius: 12px; animation: fadeIn 0.3s ease-out forwards; z-index: 10; }
.overlay h2 { color: #a6e3a1; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>