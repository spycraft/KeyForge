<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { VersionType } from '../types/vocabulary'
import { useVocabulary } from '../composables/useVocabulary'
import { useProgress } from '../composables/useProgress'
import { EdgeTTSEngine } from '../utils/edgeTtsEngine'
import { VERSION_INFO, getAvailableBooks } from '../data/bookCatalog'
import { getProgress, markWordCompleted, updateCurrentPosition } from '../utils/learningProgress'

const props = defineProps<{ version: VersionType; bookId: string }>()
defineEmits<{ back: [] }>()

const {
  currentWord, currentIndex, totalWords, progress,
  isLoading, error, isShuffled,
  load, next, prev, toggleShuffle,
} = useVocabulary()

const { recordWordProgress, getWordRecord } = useProgress()

// 【功能3】记忆功能：加载保存的学习位置
const savedProgress = ref(getProgress(props.version, props.bookId))
const isRestoredFromSave = ref(false)

const bookLabel = ref('')

interface TypingTask {
  id: string
  type: 'word' | 'phrase' | 'sentence' | 'synonym' | 'related'
  text: string
  hint: string
  completed: boolean
  userInput: string
}

const tasks = ref<TypingTask[]>([])
const currentTaskIndex = ref(0)

// 进度追踪：记录当前单词的错误数和开始时间
const wordErrorCount = ref(0)
const wordStartTime = ref(0)
// 当前单词的已有记录（用于显示掌握程度）
const currentWordRecord = ref<ReturnType<typeof getWordRecord> | null>(null)

// 音效相关
const audioContext = ref<AudioContext | null>(null)

function playCorrectSound() {
  if (!audioContext.value) {
    audioContext.value = new AudioContext()
  }
  const ctx = audioContext.value
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  
  oscillator.frequency.setValueAtTime(880, ctx.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.05)
  
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
  
  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.1)
}

function playErrorSound() {
  if (!audioContext.value) {
    audioContext.value = new AudioContext()
  }
  const ctx = audioContext.value
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  
  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(200, ctx.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)
  
  gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
  
  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 0.15)
}

watch(() => [props.version, props.bookId], async () => {
  await load(props.version, props.bookId)
  const books = getAvailableBooks(props.version)
  const found = books.find(b => b.id === props.bookId)
  bookLabel.value = found ? `${found.name} · 第${found.volume}册` : props.bookId
  
  // 【功能3】记忆功能：恢复上次学习位置
  const saved = getProgress(props.version, props.bookId)
  if (saved && saved.currentIndex > 0 && !isRestoredFromSave.value) {
    isRestoredFromSave.value = true
    // 跳转到保存的位置
    for (let i = 0; i < saved.currentIndex; i++) {
      await next()
    }
  }
}, { immediate: true })

watch(currentWord, (word) => {
  if (!word) return

  // 重置进度追踪
  wordErrorCount.value = 0
  wordStartTime.value = Date.now()
  // 加载已有记录（用于显示掌握程度）
  currentWordRecord.value = getWordRecord(props.version, props.bookId, word.word)

  const newTasks: TypingTask[] = []
  
  newTasks.push({
    id: 'word',
    type: 'word',
    text: word.word,
    hint: `输入单词`,
    completed: false,
    userInput: ''
  })
  
  word.phrases?.forEach((p, i) => {
    newTasks.push({
      id: `phrase-${i}`,
      type: 'phrase',
      text: p.phrase,
      hint: `输入短语`,
      completed: false,
      userInput: ''
    })
  })
  
  word.sentences?.forEach((s, i) => {
    newTasks.push({
      id: `sentence-${i}`,
      type: 'sentence',
      text: s.en,
      hint: `输入例句 ${i + 1}`,
      completed: false,
      userInput: ''
    })
  })
  
  word.realExamSentences?.forEach((s, i) => {
    newTasks.push({
      id: `exam-${i}`,
      type: 'sentence',
      text: s.en,
      hint: `输入真题例句`,
      completed: false,
      userInput: ''
    })
  })
  
  word.synonyms?.forEach((syn, i) => {
    syn.words.forEach((w, j) => {
      newTasks.push({
        id: `synonym-${i}-${j}`,
        type: 'synonym',
        text: w,
        hint: `输入同近词`,
        completed: false,
        userInput: ''
      })
    })
  })
  
  word.relatedWords?.forEach((rel, i) => {
    rel.words.forEach((w, j) => {
      newTasks.push({
        id: `related-${i}-${j}`,
        type: 'related',
        text: w.word,
        hint: `输入同根词`,
        completed: false,
        userInput: ''
      })
    })
  })
  
  tasks.value = newTasks
  currentTaskIndex.value = 0

  nextTick(() => {
    scrollToCurrentTask()
  })
})

const currentTask = computed(() => tasks.value[currentTaskIndex.value] || null)
const completedCount = computed(() => tasks.value.filter(t => t.completed).length)
const totalTasks = computed(() => tasks.value.length)
const isAllCompleted = computed(() => completedCount.value === totalTasks.value)

// 任务切换时预加载音频并读一遍英文（不打断正在播放的中文）
watch(currentTask, async (task) => {
  if (!task || task.completed) return
  EdgeTTSEngine.prefetch(task.text)
  const cn = getChineseText(task)
  if (cn) EdgeTTSEngine.prefetch(cn)
  // 等待当前播放完成（如上一个任务的中文）再读英文
  await EdgeTTSEngine.waitUntilDone()
  EdgeTTSEngine.speak(task.text)
})

function getChineseText(task: TypingTask): string {
  const word = currentWord.value
  if (!word) return ''

  if (task.id === 'word') {
    return word.translations.map(t => t.text).join('，')
  }
  if (task.id.startsWith('phrase-')) {
    const i = parseInt(task.id.split('-')[1])
    return word.phrases?.[i]?.translation || ''
  }
  if (task.id.startsWith('sentence-')) {
    const i = parseInt(task.id.split('-')[1])
    return word.sentences?.[i]?.cn || ''
  }
  if (task.id.startsWith('exam-')) {
    const i = parseInt(task.id.split('-')[1])
    return (word.realExamSentences?.[i] as any)?.cn || ''
  }
  if (task.id.startsWith('synonym-')) {
    const parts = task.id.split('-')
    const i = parseInt(parts[1])
    return word.synonyms?.[i]?.tran || ''
  }
  if (task.id.startsWith('related-')) {
    const parts = task.id.split('-')
    const i = parseInt(parts[1])
    const j = parseInt(parts[2])
    return word.relatedWords?.[i]?.words[j]?.tran || ''
  }
  return ''
}

/**
 * 归一化引号字符：将中文引号转换为 ASCII 引号
 * 用户可能使用中文输入法输入中文引号，但词库使用 ASCII 引号
 */
function normalizeQuote(char: string): string {
  const quoteMap: Record<string, string> = {
    '\u2019': "'",  // 右单引号 → ASCII 单引号 (常用作撇号)
    '\u2018': "'",  // 左单引号 → ASCII 单引号
    '\u201c': '"',  // 左双引号 → ASCII 双引号
    '\u201d': '"',  // 右双引号 → ASCII 双引号
    '\u201b': "'",  // 单低9引号 → ASCII 单引号
    '\u201f': '"',  // 双低9引号 → ASCII 双引号
    '\u00b4': "'",  // 尖音符 → ASCII 单引号
    '\u02b9': "'",  // 修饰字母 prime → ASCII 单引号
    '\u02bb': "'",  // 修饰字母反转逗号 → ASCII 单引号
  }
  return quoteMap[char] ?? char
}

function handleTypeChar(char: string) {
  const task = currentTask.value
  if (!task || task.completed) return

  // 归一化引号字符
  char = normalizeQuote(char)
  
  const expectedChar = task.text[task.userInput.length]
  if (char === expectedChar) {
    playCorrectSound()
    task.userInput += char
    wordErrorCount.value = 0 // 输入正确时重置错误计数
  } else {
    playErrorSound()
    wordErrorCount.value++
    
    // 【功能1】单词输入纠错机制：检测到错误时自动回退到单词开头
    // 找到当前单词的起始位置（在任务text中，当前输入位置之前的空格或任务起始位置）
    const textBeforeCursor = task.text.substring(0, task.userInput.length)
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(' ')
    const wordStartIndex = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1
    
    // 如果错误发生在单词中间（非首个字符），则回退到单词开头
    const charsIntoWord = task.userInput.length - wordStartIndex
    if (charsIntoWord > 0) {
      task.userInput = task.text.substring(0, wordStartIndex)
      // 显示回退提示（通过闪烁效果实现）
      showWordResetHint(task.id)
    }
    
    return
  }

  scrollToCurrentTask()

  if (task.userInput === task.text) {
    task.completed = true
    // 打完字后读中文（英文已在单词出现时读过）
    const cnText = getChineseText(task)
    if (cnText) {
      EdgeTTSEngine.speak(cnText)
    }

    // 当单词主任务完成时，记录学习进度
    if (task.id === 'word' && currentWord.value) {
      const duration = Date.now() - wordStartTime.value
      const totalChars = task.text.length
      const { record } = recordWordProgress(
        props.version,
        props.bookId,
        currentWord.value.word,
        wordErrorCount.value,
        totalChars,
        duration
      )
      currentWordRecord.value = record
      
      // 【功能3】记忆功能：标记单词为已完成，并保存当前位置
      markWordCompleted(props.version, props.bookId, currentIndex.value)
      updateCurrentPosition(props.version, props.bookId, currentIndex.value)
    }

    if (currentTaskIndex.value < tasks.value.length - 1) {
      setTimeout(() => {
        currentTaskIndex.value++
        nextTick(() => {
          scrollToCurrentTask()
        })
      }, 500)
    }
  }
}

// 回退提示状态
const wordResetHints = ref<Record<string, boolean>>({})

function showWordResetHint(taskId: string) {
  wordResetHints.value[taskId] = true
  setTimeout(() => {
    wordResetHints.value[taskId] = false
  }, 500)
}

function handleBackspace() {
  const task = currentTask.value
  if (task && !task.completed) {
    task.userInput = task.userInput.slice(0, -1)
  }
}

function scrollToCurrentTask() {
  const taskId = currentTask.value?.id
  if (!taskId) return
  
  const selector = getTaskSelector(taskId)
  const element = document.querySelector(selector)
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

function getTaskSelector(taskId: string): string {
  if (taskId === 'word') return '.word-header'
  if (taskId.startsWith('phrase-')) return `.phrase-item[data-task="${taskId}"]`
  if (taskId.startsWith('sentence-')) return `.sentence-item[data-task="${taskId}"]`
  if (taskId.startsWith('exam-')) return `.sentence-item[data-task="${taskId}"]`
  if (taskId.startsWith('synonym-')) return `.synonym-word[data-task="${taskId}"]`
  if (taskId.startsWith('related-')) return `.rel-word[data-task="${taskId}"]`
  return ''
}

function getCharClass(task: TypingTask, index: number): string {
  if (index < task.userInput.length) {
    return task.userInput[index] === task.text[index] ? 'correct' : 'error'
  }
  if (index === task.userInput.length) {
    return 'current'
  }
  return 'pending'
}

function displayChar(char: string): string {
  return char
}

// 空格检测辅助函数
function isSpace(char: string): boolean {
  return char === ' '
}

function playTTS(text?: string) {
  const target = text || currentTask.value?.text || currentWord.value?.word
  if (target) {
    EdgeTTSEngine.speak(target)
  }
}

function handleNext() {
  if (isAllCompleted.value) {
    // 【功能3】记忆功能：保存当前位置后再切换
    updateCurrentPosition(props.version, props.bookId, currentIndex.value)
    next()
  }
}

function handlePrev() {
  // 【功能3】记忆功能：保存当前位置后再切换
  updateCurrentPosition(props.version, props.bookId, currentIndex.value)
  prev()
}

/**
 * 从键盘 code 获取字符（处理死键情况）
 * 某些键盘布局下，单引号等键是"死键"，e.key 返回 'Dead' 而非实际字符
 */
function getCharFromCode(code: string, shiftKey: boolean): string | null {
  const keyMap: Record<string, { normal: string; shift: string }> = {
    'Quote': { normal: "'", shift: '"' },      // 单引号键 (US: ', " | UK: @, ")
    'Slash': { normal: '/', shift: '?' },
    'BracketLeft': { normal: '[', shift: '{' },
    'BracketRight': { normal: ']', shift: '}' },
    'Backslash': { normal: '\\', shift: '|' },
    'Comma': { normal: ',', shift: '<' },
    'Period': { normal: '.', shift: '>' },
    'Semicolon': { normal: ';', shift: ':' },
    'Equal': { normal: '=', shift: '+' },
    'Minus': { normal: '-', shift: '_' },
    'Digit1': { normal: '1', shift: '!' },
    'Digit2': { normal: '2', shift: '@' },
    'Digit3': { normal: '3', shift: '#' },
    'Digit4': { normal: '4', shift: '$' },
    'Digit5': { normal: '5', shift: '%' },
    'Digit6': { normal: '6', shift: '^' },
    'Digit7': { normal: '7', shift: '&' },
    'Digit8': { normal: '8', shift: '*' },
    'Digit9': { normal: '9', shift: '(' },
    'Digit0': { normal: '0', shift: ')' },
  }
  return keyMap[code]?.[shiftKey ? 'shift' : 'normal'] ?? null
}

function handleGlobalKey(e: KeyboardEvent) {
  // 如果焦点在按钮或其他可交互元素上，不拦截
  if (e.target instanceof HTMLButtonElement) return

  // Backspace: 删除最后一个字符
  if (e.key === 'Backspace') {
    e.preventDefault()
    handleBackspace()
    return
  }

  // 处理死键情况：某些键盘布局下单引号键是死键，e.key 返回 'Dead'
  if (e.key === 'Dead') {
    const char = getCharFromCode(e.code, e.shiftKey)
    if (char) {
      e.preventDefault()
      handleTypeChar(char)
      return
    }
  }

  // 可打印字符（长度为 1 的 key）
  if (e.key.length === 1) {
    // 空格在全部完成时用于翻页
    if (e.key === ' ' && isAllCompleted.value) {
      e.preventDefault()
      next()
      return
    }
    // 其他可打印字符交给打字逻辑
    e.preventDefault()
    handleTypeChar(e.key)
    return
  }

  // 功能键
  switch (e.key) {
    case 'Enter':
      e.preventDefault()
      if (isAllCompleted.value) {
        next()
      }
      break
    case 'ArrowLeft':
      e.preventDefault()
      prev()
      break
    case 'ArrowRight':
      e.preventDefault()
      if (isAllCompleted.value) next()
      break
    case 't':
    case 'T':
      e.preventDefault()
      playTTS()
      break
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey)
})

onUnmounted(() => {
  // 【功能3】记忆功能：组件卸载时保存当前位置
  updateCurrentPosition(props.version, props.bookId, currentIndex.value)
  
  window.removeEventListener('keydown', handleGlobalKey)
  if (audioContext.value) {
    audioContext.value.close()
  }
})
</script>

<template>
  <div class="practice">
    <header class="top-bar">
      <button class="back-btn" @click="$emit('back')">← 返回</button>
      <div class="book-info">
        <span class="book-title">{{ bookLabel }}</span>
        <span class="version-tag">{{ VERSION_INFO[version].label }}</span>
      </div>
      <div class="top-right">
        <span class="progress-text">{{ currentIndex + 1 }} / {{ totalWords }}</span>
        <span class="typing-progress">
          打字进度: {{ completedCount }}/{{ totalTasks }}
        </span>
        <span v-if="currentWordRecord" class="mastery-badge" :title="`掌握程度: ${currentWordRecord.mastery}%`">
          {{ currentWordRecord.mastery >= 80 ? '🌟' : currentWordRecord.mastery >= 50 ? '⭐' : '🌱' }}
          {{ currentWordRecord.mastery }}%
        </span>
        <button class="icon-btn" :class="{ active: isShuffled }" @click="toggleShuffle" title="乱序/顺序">
          {{ isShuffled ? '🔀' : '➡️' }}
        </button>
      </div>
    </header>

    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: progress + '%' }"></div>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>加载词汇书中...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p>❌ {{ error }}</p>
    </div>

    <div v-else-if="currentWord" class="practice-main">
      <div class="typing-card">
        <!-- 【功能3】记忆功能：显示已学习单词数量 -->
        <div v-if="savedProgress?.completedIndices.length" class="learned-indicator">
          ✅ 已学习 {{ savedProgress.completedIndices.length }} / {{ totalWords }} 个单词
        </div>
        
        <div 
          class="word-header" 
          :class="{ 'current-task': currentTask?.id === 'word' && !currentTask.completed }"
        >
          <div class="word-typing">
            <span
              v-for="(char, index) in currentWord.word"
              :key="index"
              :class="['char-block', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === 'word')!, index)]"
            >
              {{ displayChar(char) }}
            </span>
          </div>
          <!-- 【功能3】记忆功能：当前单词是否已学习 -->
          <span v-if="savedProgress?.completedIndices.includes(currentIndex)" class="completed-badge" title="已学习">✓</span>
          <button class="tts-btn" @mousedown.prevent="playTTS(currentWord.word)" title="听发音 (T)">🔊</button>
        </div>

        <div v-if="currentWord.phonetics" class="phonetics">
          <span v-if="currentWord.phonetics.uk" class="phonetic-item">🇬🇧 /{{ currentWord.phonetics.uk }}/</span>
          <span v-if="currentWord.phonetics.us" class="phonetic-item">🇺🇸 /{{ currentWord.phonetics.us }}/</span>
        </div>

        <div v-if="currentTask && !isAllCompleted" class="current-task-hint">
          📝 {{ currentTask.hint }}
          <span v-if="wordResetHints[currentTask.id]" class="reset-hint">↩ 请重新输入整个单词</span>
        </div>

        <div class="meaning-area">
          <section v-if="currentWord.translations.length" class="meaning-section">
            <h3 class="section-title">释义</h3>
            <div class="translations">
              <div v-for="(t, i) in currentWord.translations" :key="i" class="translation-item">
                <span v-if="t.type" class="pos-tag">{{ t.type }}</span>
                <span class="translation-text">{{ t.text }}</span>
                <button class="mini-tts-btn" @mousedown.prevent="playTTS(t.text)">🔊</button>
              </div>
            </div>
          </section>

          <section v-if="currentWord.phrases?.length" class="meaning-section">
            <h3 class="section-title">短语</h3>
            <div class="phrases">
              <div 
                v-for="(p, i) in currentWord.phrases" 
                :key="i" 
                class="phrase-item"
                :class="{ 'current-task': currentTask?.id === `phrase-${i}` && !currentTask.completed }"
                :data-task="`phrase-${i}`"
              >
                <div class="phrase-typing">
                  <span
                    v-for="(char, j) in p.phrase"
                    :key="j"
                    :class="['char-block', 'phrase-char', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === `phrase-${i}`)!, j)]"
                  >
                    {{ displayChar(char) }}
                  </span>
                </div>
                <button class="mini-tts-btn" @mousedown.prevent="playTTS(p.phrase)">🔊</button>
                <span class="phrase-cn">{{ p.translation }}</span>
              </div>
            </div>
          </section>

          <section v-if="currentWord.sentences?.length" class="meaning-section">
            <h3 class="section-title">例句</h3>
            <div class="sentences">
              <div 
                v-for="(s, i) in currentWord.sentences" 
                :key="i" 
                class="sentence-item"
                :class="{ 'current-task': currentTask?.id === `sentence-${i}` && !currentTask.completed }"
                :data-task="`sentence-${i}`"
              >
                <div class="sentence-row">
                  <div class="sentence-typing">
                    <span
                      v-for="(char, j) in s.en"
                      :key="j"
                      :class="['char-block', 'sentence-char', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === `sentence-${i}`)!, j)]"
                    >
                      {{ displayChar(char) }}
                    </span>
                  </div>
                  <button class="mini-tts-btn" @mousedown.prevent="playTTS(s.en)">🔊</button>
                </div>
                <p class="sentence-cn">{{ s.cn }}</p>
                <button v-if="s.cn" class="mini-tts-btn" @mousedown.prevent="playTTS(s.cn)">🔊</button>
              </div>
            </div>
          </section>

          <section v-if="currentWord.realExamSentences?.length" class="meaning-section">
            <h3 class="section-title">真题例句</h3>
            <div class="sentences">
              <div 
                v-for="(s, i) in currentWord.realExamSentences" 
                :key="i" 
                class="sentence-item exam-sentence"
                :class="{ 'current-task': currentTask?.id === `exam-${i}` && !currentTask.completed }"
                :data-task="`exam-${i}`"
              >
                <div class="sentence-row">
                  <div class="sentence-typing">
                    <span
                      v-for="(char, j) in s.en"
                      :key="j"
                      :class="['char-block', 'sentence-char', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === `exam-${i}`)!, j)]"
                    >
                      {{ displayChar(char) }}
                    </span>
                  </div>
                  <button class="mini-tts-btn" @mousedown.prevent="playTTS(s.en)">🔊</button>
                </div>
                <p v-if="s.source" class="sentence-source">{{ s.source }}</p>
              </div>
            </div>
          </section>

          <section v-if="currentWord.synonyms?.length" class="meaning-section">
            <h3 class="section-title">同近词</h3>
            <div class="synonyms">
              <div v-for="(syn, i) in currentWord.synonyms" :key="i" class="synonym-group">
                <span class="pos-tag">{{ syn.pos }}</span>
                <span class="synonym-tran">{{ syn.tran }}</span>
                <button v-if="syn.tran" class="mini-tts-btn" @mousedown.prevent="playTTS(syn.tran)">🔊</button>
                <div class="synonym-words">
                  <span 
                    v-for="(w, j) in syn.words" 
                    :key="j" 
                    class="synonym-word"
                    :class="{ 'current-task': currentTask?.id === `synonym-${i}-${j}` && !currentTask.completed }"
                    :data-task="`synonym-${i}-${j}`"
                  >
                    <span
                    v-for="(char, k) in w"
                    :key="k"
                    :class="['char-block', 'small-char', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === `synonym-${i}-${j}`)!, k)]"
                  >
                    {{ displayChar(char) }}
                  </span>
                    <button class="mini-tts-btn" @mousedown.prevent="playTTS(w)">🔊</button>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section v-if="currentWord.relatedWords?.length" class="meaning-section">
            <h3 class="section-title">同根词</h3>
            <div class="related-words">
              <div v-for="(rel, i) in currentWord.relatedWords" :key="i" class="rel-group">
                <span class="pos-tag">{{ rel.pos }}</span>
                <div class="rel-words">
                  <span 
                    v-for="(w, j) in rel.words" 
                    :key="j" 
                    class="rel-word"
                    :class="{ 'current-task': currentTask?.id === `related-${i}-${j}` && !currentTask.completed }"
                    :data-task="`related-${i}-${j}`"
                  >
                    <span
                      v-for="(char, k) in w.word"
                      :key="k"
                      :class="['char-block', 'small-char', { space: isSpace(char) }, getCharClass(tasks.find(t => t.id === `rel-${i}-${j}`)!, k)]"
                    >
                      {{ displayChar(char) }}
                    </span>
                    <button class="mini-tts-btn" @mousedown.prevent="playTTS(w.word)">🔊</button>
                    <span class="rel-word-tran">{{ w.tran }}</span>
                    <button v-if="w.tran" class="mini-tts-btn" @mousedown.prevent="playTTS(w.tran)">🔊</button>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section v-if="currentWord.memoryMethod" class="meaning-section">
            <h3 class="section-title">记忆法</h3>
            <p class="memory-text">{{ currentWord.memoryMethod }}</p>
          </section>
        </div>

        <div v-if="isAllCompleted" class="completion-section">
          <div class="completion-badge">🎉 全部完成！</div>
          <p class="completion-hint">按 空格/Enter 进入下一个单词</p>
        </div>
      </div>
    </div>

    <footer v-if="!isLoading && !error" class="bottom-nav">
      <button class="nav-btn" :disabled="currentIndex === 0" @click="handlePrev">
        ← 上一个
      </button>
      <span class="nav-hint">
        {{ isAllCompleted ? '🎉 按空格/Enter 进入下一个' : `📝 完成打字练习 (${completedCount}/${totalTasks})` }}
        · T 发音 · ←→ 翻页
      </span>
      <button class="nav-btn primary" :disabled="currentIndex >= totalWords - 1 || !isAllCompleted" @click="handleNext">
        下一个 →
      </button>
    </footer>
  </div>
</template>

<style scoped>
.practice {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #313244;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  gap: 1rem;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
}

.book-info {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.book-title {
  color: #cdd6f4;
  font-size: 1.05rem;
  font-weight: 600;
}

.version-tag {
  background: #45475a;
  color: #b4befe;
  padding: 2px 10px;
  border-radius: 16px;
  font-size: 0.75rem;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.progress-text {
  color: #a6adc8;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.typing-progress {
  background: rgba(166, 227, 161, 0.1);
  color: #a6e3a1;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
}

.mastery-badge {
  background: rgba(249, 226, 175, 0.12);
  color: #f9e2af;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  white-space: nowrap;
}

.icon-btn {
  background: transparent;
  border: 1px solid #45475a;
  border-radius: 8px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.icon-btn.active {
  border-color: #f9e2af;
  background: rgba(249, 226, 175, 0.1);
}

.back-btn {
  background: transparent;
  border: 1px solid #45475a;
  color: #a6adc8;
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-size: 0.9rem;
}

.back-btn:hover {
  border-color: #89b4fa;
  color: #cdd6f4;
  background: #313244;
}

.progress-bar {
  height: 3px;
  background: #1e1e2e;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #89b4fa, #b4befe);
  transition: width 0.3s ease;
  border-radius: 0 2px 2px 0;
}

.loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #a6adc8;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #45475a;
  border-top-color: #89b4fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f38ba8;
  font-size: 1.1rem;
}

.practice-main {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 2rem 2rem;
  background: #313244;
}

.typing-card {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  min-height: calc(100% - 2rem);
  border: 1px solid #45475a;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.word-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  transition: all 0.2s;
  margin-bottom: 1rem;
}

.word-header.current-task {
  background: rgba(137, 180, 250, 0.15);
  border: 2px solid #89b4fa;
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(137, 180, 250, 0.3);
}

.word-typing {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  /* 【功能3】单词完整性显示：确保单词不拆分到两行 */
  flex-wrap: nowrap;
  white-space: nowrap;
}

.char-block {
  font-size: 2.8rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  /* 【功能1】单词完整性显示：防止单词字符被拆分到两行 */
  display: inline-block;
  word-break: keep-all;
  transition: all 0.15s ease;
}

/* 空格使用下划线或底部标记表示 */
.char-block.space::before {
  content: '';
  position: absolute;
  bottom: 0.1em;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(137, 180, 250, 0.3);
  border-radius: 1px;
}

/* 空格_pending 状态 */
.char-block.space.pending::before {
  background: rgba(88, 91, 112, 0.4);
}

/* 空格_correct 状态 */
.char-block.space.correct::before {
  background: rgba(166, 227, 161, 0.5);
}

/* 空格_current 状态 */
.char-block.space.current::before {
  background: rgba(137, 180, 250, 0.6);
}

.char-block.pending {
  color: #585b70;
}

.char-block.correct {
  color: #a6e3a1;
}

.char-block.error {
  color: #f38ba8;
  background: rgba(243, 139, 168, 0.2);
  border-radius: 6px;
}

.char-block.current {
  color: #89b4fa;
}

.word-header.current-task .char-block {
  font-size: 3.2rem;
}

.word-header.current-task .char-block.current {
  font-size: 3.5rem;
  font-weight: 900;
}

.char-block.phrase-char {
  font-size: 1.6rem; /* 【功能2】短语排版：主单词的50%（3.2rem * 0.5） */
  font-weight: normal;
}

.char-block.phrase-char.current {
  color: #89b4fa;
}

.phrase-item.current-task .char-block.phrase-char {
  font-size: 3.2rem;
  font-weight: 800;
}

.phrase-item.current-task .char-block.phrase-char.current {
  font-size: 3.5rem;
  font-weight: 900;
}

.char-block.sentence-char {
  font-size: 1.6rem; /* 【功能2】例句排版：主单词的50%（3.2rem * 0.5） */
  font-weight: normal;
}

.char-block.sentence-char.current {
  color: #89b4fa;
}

.sentence-item.current-task .char-block.sentence-char {
  font-size: 3.2rem;
  font-weight: 800;
}

.sentence-item.current-task .char-block.sentence-char.current {
  font-size: 3.5rem;
  font-weight: 900;
}

.char-block.small-char {
  font-size: 0.85rem;
  font-weight: 600;
}

.char-block.small-char.current {
  color: #89b4fa;
}

.synonym-word.current-task .char-block.small-char,
.rel-word.current-task .char-block.small-char {
  font-size: 3.2rem;
  font-weight: 800;
}

.synonym-word.current-task .char-block.small-char.current,
.rel-word.current-task .char-block.small-char.current {
  font-size: 3.5rem;
  font-weight: 900;
}

.tts-btn {
  background: #45475a;
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.3rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tts-btn:hover {
  background: #89b4fa;
  transform: scale(1.05);
}

.mini-tts-btn {
  background: transparent;
  border: 1px solid #585b70;
  color: #a6adc8;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.mini-tts-btn:hover {
  background: #89b4fa;
  border-color: #89b4fa;
  color: #1e1e2e;
}

.phonetics {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.6rem;
}

.phonetic-item {
  color: #a6adc8;
  font-size: 1rem;
}

/* 【功能3】记忆功能：已学习标记样式 */
.learned-indicator {
  padding: 0.5rem 1rem;
  margin-bottom: 0.5rem;
  background: rgba(166, 227, 161, 0.1);
  border: 1px solid #a6e3a1;
  border-radius: 8px;
  color: #a6e3a1;
  font-size: 0.9rem;
  text-align: center;
}

.completed-badge {
  margin-left: 0.5rem;
  color: #a6e3a1;
  font-size: 1.5rem;
  font-weight: bold;
}

.current-task-hint {
  margin-top: 1.5rem;
  padding: 0.8rem 1rem;
  background: rgba(137, 180, 250, 0.1);
  border: 1px solid #89b4fa;
  border-radius: 8px;
  color: #b4befe;
  text-align: center;
  font-size: 0.95rem;
}

.reset-hint {
  /* 【功能1】回退提示样式 */
  margin-left: 1rem;
  color: #f38ba8;
  animation: pulse-hint 0.5s ease-in-out;
}

@keyframes pulse-hint {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.completion-section {
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(166, 227, 161, 0.1);
  border: 1px solid #a6e3a1;
  border-radius: 12px;
  text-align: center;
}

.completion-badge {
  color: #a6e3a1;
  font-size: 1.2rem;
  font-weight: 600;
}

.completion-hint {
  color: #a6adc8;
  font-size: 0.9rem;
}

.meaning-area {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #45475a;
}

.meaning-section {
  margin-bottom: 1.2rem;
}

.section-title {
  font-size: 0.85rem;
  color: #89b4fa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #45475a;
}

.translations {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.translation-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.pos-tag {
  background: #45475a;
  color: #fab387;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 36px;
  text-align: center;
  flex-shrink: 0;
}

.translation-text {
  color: #cdd6f4;
  font-size: 1.05rem;
}

.phrases {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.phrase-item {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  padding: 0.7rem;
  border-radius: 10px;
  transition: all 0.2s;
}

.phrase-item.current-task {
  background: rgba(137, 180, 250, 0.1);
  border: 2px solid #89b4fa;
  transform: scale(1.01);
}

.phrase-typing {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  /* 【功能3】单词完整性显示：确保单词不拆分到两行 */
  flex-wrap: nowrap;
  white-space: nowrap;
}

.phrase-cn {
  color: #a6adc8;
  font-size: 0.95rem;
}

.sentences {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.sentence-item {
  padding: 0.7rem 0.9rem;
  background: rgba(30, 30, 46, 0.5);
  border-radius: 10px;
  border-left: 4px solid #585b70;
  transition: all 0.2s;
}

.sentence-item.current-task {
  background: rgba(137, 180, 250, 0.1);
  border-color: #89b4fa;
  transform: scale(1.01);
}

.exam-sentence {
  border-left-color: #fab387;
}

.exam-sentence.current-task {
  border-color: #89b4fa;
}

.sentence-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sentence-typing {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  /* 【功能2】句子显示规则：允许句子正常换行，但单词不拆分 */
  flex-wrap: wrap;
  white-space: normal;
  word-break: normal;
  overflow-wrap: break-word;
}

.sentence-cn {
  color: #a6adc8;
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
}

.sentence-source {
  color: #fab387;
  font-size: 0.75rem;
  margin: 0.2rem 0 0;
}

.synonyms {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.synonym-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.synonym-tran {
  color: #a6adc8;
  font-size: 0.95rem;
}

.synonym-words {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.synonym-word {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #1e1e2e;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #45475a;
  transition: all 0.2s;
}

.synonym-word.current-task {
  background: rgba(137, 180, 250, 0.15);
  border-color: #89b4fa;
  transform: scale(1.05);
}

.related-words {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.rel-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rel-words {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.rel-word {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  background: rgba(30, 30, 46, 0.5);
  transition: all 0.2s;
}

.rel-word.current-task {
  background: rgba(137, 180, 250, 0.15);
  border: 1px solid #89b4fa;
  transform: scale(1.02);
}

.rel-word-tran {
  color: #a6adc8;
  font-size: 0.9rem;
}

.memory-text {
  color: #cdd6f4;
  background: rgba(30, 30, 46, 0.5);
  padding: 0.8rem 1rem;
  border-radius: 10px;
  margin: 0;
  line-height: 1.6;
  border-left: 4px solid #a6e3a1;
}

.bottom-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #1e1e2e;
  border-top: 1px solid #313244;
}

.nav-btn {
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  padding: 8px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  font-size: 0.95rem;
}

.nav-btn:hover:not(:disabled) {
  border-color: #89b4fa;
  background: #45475a;
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-btn.primary {
  background: #89b4fa;
  color: #1e1e2e;
  border-color: #89b4fa;
  font-weight: 600;
}

.nav-btn.primary:hover:not(:disabled) {
  background: #b4befe;
}

.nav-hint {
  color: #6c7086;
  font-size: 0.8rem;
}
</style>
