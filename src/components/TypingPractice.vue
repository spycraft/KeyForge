<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  text: string
  hint?: string
  autoStart?: boolean
}>()

const emit = defineEmits<{
  complete: [correct: boolean, time: number, accuracy: number]
  reset: []
}>()

const input = ref('')
const isStarted = ref(false)
const startTime = ref(0)
const endTime = ref(0)
const isCompleted = ref(false)

const correctChars = computed(() => {
  let count = 0
  for (let i = 0; i < input.value.length; i++) {
    if (input.value[i] === props.text[i]) count++
  }
  return count
})

const accuracy = computed(() => {
  if (!input.value.length) return 100
  return Math.round((correctChars.value / input.value.length) * 100)
})

const remainingTime = computed(() => {
  if (!isStarted.value || isCompleted.value) return 0
  return Math.round((Date.now() - startTime.value) / 1000)
})

const displayText = computed(() => {
  return props.text.split('').map((char, index) => {
    let className = 'char-default'
    if (index < input.value.length) {
      className = input.value[index] === char ? 'char-correct' : 'char-error'
    } else if (index === input.value.length) {
      className = 'char-current'
    }
    return { char, className }
  })
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  input.value = target.value

  if (!isStarted.value) {
    isStarted.value = true
    startTime.value = Date.now()
  }

  if (input.value === props.text) {
    isCompleted.value = true
    endTime.value = Date.now()
    const time = Math.round((endTime.value - startTime.value) / 1000)
    emit('complete', true, time, 100)
  }
}

function reset() {
  input.value = ''
  isStarted.value = false
  startTime.value = 0
  endTime.value = 0
  isCompleted.value = false
  emit('reset')
}

watch(() => props.text, () => {
  reset()
})
</script>

<template>
  <div class="typing-practice">
    <!-- 进度信息 -->
    <div class="typing-stats">
      <span class="stat">⏱️ {{ remainingTime }}s</span>
      <span class="stat">🎯 {{ accuracy }}%</span>
    </div>

    <!-- 提示 -->
    <p v-if="hint" class="typing-hint">{{ hint }}</p>

    <!-- 显示文本 -->
    <div class="typing-display">
      <span
        v-for="(item, index) in displayText"
        :key="index"
        :class="['char', item.className]"
      >{{ item.char }}</span>
    </div>

    <!-- 输入框 -->
    <input
      v-model="input"
      @input="handleInput"
      class="typing-input"
      :class="{ completed: isCompleted }"
      :placeholder="isCompleted ? '🎉 完成！按回车重新开始' : '点击这里开始输入...'"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
    />

    <!-- 完成提示 -->
    <div v-if="isCompleted" class="typing-complete">
      <p>完成！用时 {{ remainingTime }} 秒，正确率 100%</p>
      <button class="restart-btn" @click="reset">🔄 再来一次</button>
    </div>
  </div>
</template>

<style scoped>
.typing-practice {
  background: #1e1e2e;
  border-radius: 12px;
  padding: 1rem 1.5rem;
}

.typing-stats {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #a6adc8;
}

.stat {
  background: #313244;
  padding: 4px 10px;
  border-radius: 8px;
}

.typing-hint {
  color: #6c7086;
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}

.typing-display {
  font-size: 1.4rem;
  font-family: 'JetBrainsMono Nerd Font Mono', 'JetBrains Mono', 'SF Mono', monospace;
  line-height: 1.6;
  min-height: 2.4rem;
  padding: 0.8rem;
  background: #313244;
  border-radius: 8px;
  margin-bottom: 1rem;
  letter-spacing: 0.02em;
}

.char {
  transition: all 0.1s ease;
}

.char-default {
  color: #6c7086;
}

.char-correct {
  color: #a6e3a1;
}

.char-error {
  color: #f38ba8;
  background: rgba(243, 139, 168, 0.2);
  border-radius: 3px;
}

.char-current {
  color: #cdd6f4;
  background: #89b4fa;
  border-radius: 3px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.typing-input {
  width: 100%;
  padding: 1rem;
  font-size: 1.2rem;
  font-family: inherit;
  background: #313244;
  border: 2px solid #45475a;
  border-radius: 8px;
  color: #cdd6f4;
  outline: none;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.typing-input:focus {
  border-color: #89b4fa;
}

.typing-input.completed {
  border-color: #a6e3a1;
  background: rgba(166, 227, 161, 0.1);
}

.typing-input::placeholder {
  color: #6c7086;
}

.typing-complete {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(166, 227, 161, 0.1);
  border: 1px solid #a6e3a1;
  border-radius: 8px;
  text-align: center;
}

.typing-complete p {
  margin: 0 0 0.5rem;
  color: #a6e3a1;
}

.restart-btn {
  background: #89b4fa;
  color: #1e1e2e;
  border: none;
  padding: 6px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.restart-btn:hover {
  background: #b4befe;
}
</style>
