<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProgress } from '../composables/useProgress'
import { EdgeTTSEngine } from '../utils/edgeTtsEngine'
import { loadBook } from '../data/bookCatalog'
import { formatNextReview } from '../utils/ebbinghaus'
import type { WordRecord } from '../types/progress'
import type { NormalizedWord } from '../types/vocabulary'

defineEmits<{ back: [] }>()

const { dueReviews, recordWordProgress, refreshStats } = useProgress()

interface ReviewItem {
  record: WordRecord
  word: NormalizedWord | null
  userInput: string
  errors: number
  startTime: number
  completed: boolean
  showAnswer: boolean
}

const items = ref<ReviewItem[]>([])
const currentIndex = ref(0)
const isLoading = ref(true)
const audioContext = ref<AudioContext | null>(null)

const currentItem = computed(() => items.value[currentIndex.value] || null)
const completedCount = computed(() => items.value.filter(i => i.completed).length)
const totalCount = computed(() => items.value.length)
const isAllDone = computed(() => totalCount.value > 0 && completedCount.value === totalCount.value)

// 加载复习单词的释义数据
async function loadReviewItems() {
  isLoading.value = true
  const records = [...dueReviews.value]

  // 按 version+bookId 分组加载
  const groupMap = new Map<string, WordRecord[]>()
  for (const r of records) {
    const key = `${r.version}:${r.bookId}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(r)
  }

  const wordMap = new Map<string, NormalizedWord>()

  for (const [key, recs] of groupMap) {
    const [version, bookId] = key.split(':')
    try {
      const words = await loadBook(version as any, bookId)
      for (const r of recs) {
        const found = words.find(w => w.word === r.word)
        if (found) wordMap.set(r.id, found)
      }
    } catch (e) {
      console.error(`加载词汇书失败 ${key}:`, e)
    }
  }

  items.value = records.map(r => ({
    record: r,
    word: wordMap.get(r.id) || null,
    userInput: '',
    errors: 0,
    startTime: 0,
    completed: false,
    showAnswer: false,
  }))

  isLoading.value = false

  // 预加载第一个单词的音频
  if (items.value.length > 0 && items.value[0].word) {
    EdgeTTSEngine.prefetch(items.value[0].word.word)
  }
}

// 音效
function playSound(type: 'correct' | 'error') {
  if (!audioContext.value) audioContext.value = new AudioContext()
  const ctx = audioContext.value
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  if (type === 'correct') {
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
  } else {
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
  }

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + (type === 'correct' ? 0.1 : 0.15))
}

function handleKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLButtonElement) return
  const item = currentItem.value
  if (!item || item.completed) return

  // 显示答案后，按空格或回车继续
  if (item.showAnswer) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      completeReview(item)
    }
    return
  }

  if (e.key === 'Backspace') {
    e.preventDefault()
    item.userInput = item.userInput.slice(0, -1)
    return
  }

  if (e.key.length === 1) {
    e.preventDefault()
    const expected = item.record.word[item.userInput.length]
    if (e.key === expected) {
      playSound('correct')
      item.userInput += e.key
      if (item.startTime === 0) item.startTime = Date.now()

      // 打完整个单词
      if (item.userInput === item.record.word) {
        item.showAnswer = true
        // 读英文和中文
        EdgeTTSEngine.speak(item.record.word).then(() => {
          const cn = item.word?.translations.map(t => t.text).join('，')
          if (cn) EdgeTTSEngine.speak(cn)
        })
      }
    } else {
      playSound('error')
      item.errors++
    }
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    item.showAnswer = true
  }
}

function completeReview(item: ReviewItem) {
  item.completed = true
  const duration = Date.now() - (item.startTime || Date.now())
  const totalChars = item.record.word.length

  const { record } = recordWordProgress(
    item.record.version,
    item.record.bookId,
    item.record.word,
    item.errors,
    totalChars,
    duration
  )
  item.record = record

  // 预加载下一个
  const next = items.value[currentIndex.value + 1]
  if (next?.word) {
    EdgeTTSEngine.prefetch(next.word.word)
  }

  // 自动进入下一个
  if (currentIndex.value < items.value.length - 1) {
    setTimeout(() => {
      currentIndex.value++
    }, 300)
  }
}

function getCharClass(item: ReviewItem, index: number): string {
  if (index < item.userInput.length) {
    return item.userInput[index] === item.record.word[index] ? 'correct' : 'error'
  }
  if (index === item.userInput.length && !item.showAnswer) {
    return 'current'
  }
  return 'pending'
}

function getUrgencyColor(nextReviewAt: number): string {
  const diff = nextReviewAt - Date.now()
  if (diff <= 0) return '#f38ba8'
  if (diff < 24 * 60 * 60 * 1000) return '#f9e2af'
  return '#a6e3a1'
}

onMounted(() => {
  loadReviewItems()
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  refreshStats()
})
</script>

<template>
  <div class="review">
    <header class="top-bar">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <div class="header-info">
        <span class="header-title">智能复习</span>
        <span class="header-count">{{ completedCount }} / {{ totalCount }}</span>
      </div>
      <div class="top-right">
        <span class="due-badge" v-if="!isAllDone">{{ totalCount - completedCount }} 待复习</span>
      </div>
    </header>

    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: totalCount > 0 ? (completedCount / totalCount * 100) + '%' : '0%' }"></div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>加载复习内容...</p>
    </div>

    <div v-else-if="totalCount === 0" class="empty-state">
      <div class="empty-icon">✅</div>
      <p class="empty-title">暂无需要复习的单词</p>
      <p class="empty-desc">去学习新单词吧，复习计划会自动安排！</p>
      <button class="back-btn" @click="$emit('back')">返回首页</button>
    </div>

    <div v-else-if="isAllDone" class="complete-state">
      <div class="complete-icon">🎉</div>
      <p class="complete-title">复习完成！</p>
      <p class="complete-desc">本次复习了 {{ totalCount }} 个单词</p>
      <button class="back-btn" @click="$emit('back')">返回首页</button>
    </div>

    <div v-else-if="currentItem" class="review-main">
      <!-- 复习卡片 -->
      <div class="review-card">
        <!-- 上次复习信息 -->
        <div class="review-meta">
          <span class="meta-item">
            掌握: <span class="meta-value" :style="{ color: getUrgencyColor(currentItem.record.nextReviewAt) }">{{ currentItem.record.mastery }}%</span>
          </span>
          <span class="meta-item">
            复习次数: <span class="meta-value">{{ currentItem.record.reviewCount }}</span>
          </span>
          <span class="meta-item">
            上次: <span class="meta-value">{{ formatNextReview(currentItem.record.nextReviewAt) }}</span>
          </span>
        </div>

        <!-- 打字区域 -->
        <div class="typing-area">
          <div class="word-display">
            <span
              v-for="(char, i) in currentItem.record.word"
              :key="i"
              :class="['char', getCharClass(currentItem, i)]"
            >{{ char }}</span>
          </div>
        </div>

        <!-- 答案区（打完后显示） -->
        <Transition name="slide-up">
          <div v-if="currentItem.showAnswer" class="answer-area">
            <div class="answer-word">{{ currentItem.word?.word || currentItem.record.word }}</div>
            <div v-if="currentItem.word?.phonetics" class="answer-phonetic">
              <span v-if="currentItem.word.phonetics.us">美 {{ currentItem.word.phonetics.us }}</span>
              <span v-if="currentItem.word.phonetics.uk">英 {{ currentItem.word.phonetics.uk }}</span>
            </div>
            <div class="answer-translations">
              <div v-for="(t, i) in currentItem.word?.translations" :key="i" class="translation-item">
                <span class="pos" v-if="t.type">{{ t.type }}</span>
                <span class="tran-text">{{ t.text }}</span>
              </div>
            </div>
            <div v-if="currentItem.word?.phrases?.length" class="answer-phrases">
              <div v-for="(p, i) in currentItem.word.phrases.slice(0, 3)" :key="i" class="phrase-item">
                <span class="phrase-en">{{ p.phrase }}</span>
                <span class="phrase-cn">{{ p.translation }}</span>
              </div>
            </div>
            <div class="answer-stats">
              <span>本次错误: {{ currentItem.errors }}</span>
              <span>·</span>
              <span>按空格继续</span>
            </div>
          </div>
        </Transition>

        <!-- 提示 -->
        <div v-if="!currentItem.showAnswer" class="hint">
          输入单词拼写 · 按 Enter 直接看答案
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  background: rgba(49, 50, 68, 0.5);
  border-bottom: 1px solid #45475a;
}

.back-btn {
  background: transparent;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: #89b4fa;
  color: #89b4fa;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.header-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.header-count {
  color: #a6adc8;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.due-badge {
  background: rgba(249, 226, 175, 0.12);
  color: #f9e2af;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.progress-bar {
  height: 3px;
  background: #313244;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #89b4fa, #a6e3a1);
  transition: width 0.3s ease;
}

.loading, .empty-state, .complete-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #45475a;
  border-top-color: #89b4fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon, .complete-icon {
  font-size: 3rem;
}

.empty-title, .complete-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
}

.empty-desc, .complete-desc {
  color: #a6adc8;
  margin: 0;
}

.review-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.review-card {
  width: 100%;
  max-width: 560px;
  background: rgba(49, 50, 68, 0.4);
  border: 1px solid #45475a;
  border-radius: 16px;
  padding: 2rem;
}

.review-meta {
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: #6c7086;
}

.meta-value {
  color: #cdd6f4;
  font-weight: 600;
}

.typing-area {
  text-align: center;
  margin: 1.5rem 0;
}

.word-display {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-family: 'JetBrainsMono Nerd Font Mono', 'JetBrains Mono', monospace;
}

.char {
  transition: color 0.15s, transform 0.15s;
  display: inline-block;
}

.char.correct { color: #a6e3a1; }
.char.error { color: #f38ba8; }
.char.current {
  color: #89b4fa;
  transform: scale(1.15);
  animation: pulse 1s ease-in-out infinite;
}
.char.pending { color: #45475a; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.answer-area {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #45475a;
}

.answer-word {
  font-size: 1.4rem;
  font-weight: 700;
  color: #b4befe;
  margin-bottom: 0.3rem;
}

.answer-phonetic {
  display: flex;
  gap: 1rem;
  color: #a6adc8;
  font-size: 0.9rem;
  margin-bottom: 0.8rem;
}

.answer-translations {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.8rem;
}

.translation-item {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
}

.pos {
  color: #fab387;
  font-size: 0.85rem;
  font-style: italic;
  min-width: 2.5rem;
}

.tran-text {
  color: #cdd6f4;
}

.answer-phrases {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.8rem;
}

.phrase-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.phrase-en { color: #89b4fa; }
.phrase-cn { color: #a6adc8; }

.answer-stats {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  color: #6c7086;
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.hint {
  text-align: center;
  color: #6c7086;
  font-size: 0.85rem;
  margin-top: 1rem;
}

.slide-up-enter-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
</style>
