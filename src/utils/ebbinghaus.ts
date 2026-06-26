// ============================================================
// 艾宾浩斯遗忘曲线 + SM-2 间隔重复算法
// ============================================================

import type { WordRecord, ReviewLog } from '../types/progress'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 艾宾浩斯遗忘曲线经典复习间隔（天）：
 * 5分钟、30分钟、12小时、1天、2天、4天、7天、15天
 * 这里转换为天为单位（小数表示小时内）
 */
const EBINGHAUS_INTERVALS = [
  5 / (24 * 60),     // 5 分钟
  30 / (24 * 60),    // 30 分钟
  12 / 24,           // 12 小时
  1,                 // 1 天
  2,                 // 2 天
  4,                 // 4 天
  7,                 // 7 天
  15,                // 15 天
]

/**
 * SM-2 算法核心：根据评分更新 ease factor 和间隔
 *
 * @param easeFactor 当前熟悉度因子（初始 2.5）
 * @param correctStreak 连续答对次数
 * @param quality 评分 0-5
 * @returns { easeFactor, intervalDays, correctStreak }
 */
export function sm2Update(
  easeFactor: number,
  correctStreak: number,
  quality: number
): { easeFactor: number; intervalDays: number; correctStreak: number } {
  // quality >= 3 表示答对
  const passed = quality >= 3

  // 更新 ease factor（SM-2 公式）
  let newEF = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  // ease factor 最低 1.3
  newEF = Math.max(1.3, newEF)

  let newStreak = passed ? correctStreak + 1 : 0
  let intervalDays: number

  if (!passed) {
    // 答错：重置间隔，但保留 ease factor 的降低
    intervalDays = EBINGHAUS_INTERVALS[0]
  } else if (newStreak === 1) {
    intervalDays = 1
  } else if (newStreak === 2) {
    intervalDays = 3
  } else if (newStreak <= EBINGHAUS_INTERVALS.length) {
    // 结合艾宾浩斯间隔和 SM-2 的 ease factor
    const ebbinghausDay = EBINGHAUS_INTERVALS[Math.min(newStreak - 1, EBINGHAUS_INTERVALS.length - 1)]
    intervalDays = Math.max(ebbinghausDay, newStreak * newEF)
  } else {
    // 超过艾宾浩斯预设间隔后，纯 SM-2 计算
    intervalDays = newStreak * newEF
  }

  // 确保最小间隔
  intervalDays = Math.max(intervalDays, 0.01)

  return {
    easeFactor: Math.round(newEF * 100) / 100,
    intervalDays: Math.round(intervalDays * 100) / 100,
    correctStreak: newStreak,
  }
}

/**
 * 根据评分计算掌握程度
 * quality 0-5 -> mastery 0-100
 */
export function qualityToMastery(quality: number, currentMastery: number): number {
  const qualityMastery = (quality / 5) * 100
  // 平滑过渡：新掌握程度 = 70% 旧 + 30% 新（避免剧烈波动）
  const newMastery = currentMastery * 0.7 + qualityMastery * 0.3
  return Math.round(Math.max(0, Math.min(100, newMastery)))
}

/**
 * 创建新单词的学习记录
 */
export function createNewRecord(
  version: string,
  bookId: string,
  word: string
): WordRecord {
  const now = Date.now()
  const id = `${version}:${bookId}:${word}`
  return {
    id,
    word,
    version,
    bookId,
    firstLearnedAt: now,
    lastReviewedAt: now,
    nextReviewAt: now + DAY_MS, // 默认 1 天后复习
    reviewCount: 0,
    correctStreak: 0,
    easeFactor: 2.5,
    intervalDays: 1,
    mastery: 0,
    totalStudyTime: 0,
    totalErrors: 0,
    totalCorrect: 0,
    history: [],
  }
}

/**
 * 应用一次复习结果，返回更新后的记录
 */
export function applyReview(
  record: WordRecord,
  quality: number,
  durationMs: number,
  errors: number
): WordRecord {
  const now = Date.now()

  const { easeFactor, intervalDays, correctStreak } = sm2Update(
    record.easeFactor,
    record.correctStreak,
    quality
  )

  const mastery = qualityToMastery(quality, record.mastery)

  const log: ReviewLog = {
    at: now,
    quality,
    duration: durationMs,
    errors,
  }

  // 保留最近 20 条历史
  const history = [...record.history, log].slice(-20)

  return {
    ...record,
    lastReviewedAt: now,
    nextReviewAt: now + Math.round(intervalDays * DAY_MS),
    reviewCount: record.reviewCount + 1,
    correctStreak,
    easeFactor,
    intervalDays,
    mastery,
    totalStudyTime: record.totalStudyTime + durationMs,
    totalErrors: record.totalErrors + errors,
    totalCorrect: record.totalCorrect + (quality >= 3 ? 1 : 0),
    history,
  }
}

/**
 * 获取复习紧迫程度（用于 UI 展示）
 */
export function getUrgencyLevel(nextReviewAt: number): 'overdue' | 'today' | 'soon' | 'future' {
  const now = Date.now()
  const diff = nextReviewAt - now

  if (diff <= 0) return 'overdue'
  if (diff < DAY_MS) return 'today'
  if (diff < 3 * DAY_MS) return 'soon'
  return 'future'
}

/**
 * 格式化下次复习时间为人可读文本
 */
export function formatNextReview(nextReviewAt: number): string {
  const now = Date.now()
  const diff = nextReviewAt - now

  if (diff <= 0) {
    const hoursOverdue = Math.abs(diff) / (60 * 60 * 1000)
    if (hoursOverdue < 1) return '已过期'
    if (hoursOverdue < 24) return `过期 ${Math.round(hoursOverdue)} 小时`
    return `过期 ${Math.round(hoursOverdue / 24)} 天`
  }

  const hours = diff / (60 * 60 * 1000)
  if (hours < 1) return `${Math.round(diff / 60000)} 分钟后`
  if (hours < 24) return `${Math.round(hours)} 小时后`
  return `${Math.round(hours / 24)} 天后`
}
