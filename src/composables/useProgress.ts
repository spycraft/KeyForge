import { ref, computed } from 'vue'
import type { WordRecord, StudyStats } from '../types/progress'
import { scoreFromTyping } from '../types/progress'
import {
  getStudyStats,
  getRecord,
  saveRecord,
  getAllRecords,
  getDueReviews,
  recordDailyActivity,
  makeRecordId,
} from '../utils/storage'
import { createNewRecord, applyReview } from '../utils/ebbinghaus'

/**
 * 学习进度与复习管理 composable
 */
export function useProgress() {
  const stats = ref<StudyStats>(getStudyStats())
  const dueReviews = ref<WordRecord[]>(getDueReviews())

  /** 刷新统计数据 */
  function refreshStats() {
    stats.value = getStudyStats()
    dueReviews.value = getDueReviews()
  }

  /**
   * 记录一次单词学习/复习
   * 在用户打完一个单词的所有任务后调用
   */
  function recordWordProgress(
    version: string,
    bookId: string,
    word: string,
    errors: number,
    totalChars: number,
    durationMs: number
  ) {
    const id = makeRecordId(version, bookId, word)
    const existing = getRecord(id)
    const quality = scoreFromTyping(errors, totalChars, durationMs)

    let record: WordRecord
    let isNew = false

    if (existing) {
      record = applyReview(existing, quality, durationMs, errors)
    } else {
      isNew = true
      record = createNewRecord(version, bookId, word)
      record = applyReview(record, quality, durationMs, errors)
    }

    saveRecord(record)
    recordDailyActivity(isNew ? 'learned' : 'reviewed', durationMs)
    refreshStats()

    return { record, quality, isNew }
  }

  /** 获取某个单词的记录 */
  function getWordRecord(version: string, bookId: string, word: string): WordRecord | null {
    return getRecord(makeRecordId(version, bookId, word))
  }

  /** 获取所有已学习单词 */
  const allRecords = computed(() => getAllRecords())

  /** 待复习数量 */
  const dueCount = computed(() => dueReviews.value.length)

  /** 是否有需要复习的单词 */
  const hasDueReviews = computed(() => dueCount.value > 0)

  return {
    stats,
    dueReviews,
    dueCount,
    hasDueReviews,
    allRecords,
    refreshStats,
    recordWordProgress,
    getWordRecord,
  }
}
