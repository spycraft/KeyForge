import { ref, computed } from 'vue'
import type { VersionType, NormalizedWord } from '../types/vocabulary'
import { loadBook } from '../data/bookCatalog'

export function useVocabulary() {
  const words = ref<NormalizedWord[]>([])
  const currentIndex = ref(0)
  const isLoading = ref(false)
  const error = ref('')
  const isShuffled = ref(false)
  const showMeaning = ref(false)

  // 保留原始顺序的副本，用于取消乱序时恢复
  let originalOrder: NormalizedWord[] = []

  const currentWord = computed<NormalizedWord | null>(() => {
    return words.value[currentIndex.value] ?? null
  })

  const totalWords = computed(() => words.value.length)
  const progress = computed(() => {
    if (totalWords.value === 0) return 0
    return Math.round(((currentIndex.value + 1) / totalWords.value) * 100)
  })

  async function load(version: VersionType, bookId: string) {
    isLoading.value = true
    error.value = ''
    try {
      const data = await loadBook(version, bookId)
      originalOrder = [...data]
      words.value = data
      currentIndex.value = 0
      showMeaning.value = false
    } catch (e: any) {
      error.value = e?.message || '加载词汇书失败'
      words.value = []
    } finally {
      isLoading.value = false
    }
  }

  function next() {
    if (currentIndex.value < words.value.length - 1) {
      currentIndex.value++
      showMeaning.value = false
    }
  }

  function prev() {
    if (currentIndex.value > 0) {
      currentIndex.value--
      showMeaning.value = false
    }
  }

  function toggleMeaning() {
    showMeaning.value = !showMeaning.value
  }

  function toggleShuffle() {
    isShuffled.value = !isShuffled.value
    const current = words.value[currentIndex.value]
    if (isShuffled.value) {
      // Fisher-Yates 洗牌
      const arr = [...words.value]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      words.value = arr
    } else {
      words.value = [...originalOrder]
    }
    // 尝试保持当前位置
    const newIdx = words.value.findIndex(w => w.word === current?.word)
    currentIndex.value = newIdx >= 0 ? newIdx : 0
    showMeaning.value = false
  }

  function goTo(index: number) {
    if (index >= 0 && index < words.value.length) {
      currentIndex.value = index
      showMeaning.value = false
    }
  }

  return {
    words,
    currentIndex,
    currentWord,
    totalWords,
    progress,
    isLoading,
    error,
    isShuffled,
    showMeaning,
    load,
    next,
    prev,
    toggleMeaning,
    toggleShuffle,
    goTo,
  }
}
