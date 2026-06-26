// ============================================================
// 学习进度与复习系统类型定义
// ============================================================

/** 单个单词的学习记录 */
export interface WordRecord {
  /** 唯一标识：`${version}:${bookId}:${word}` */
  id: string
  word: string
  version: string
  bookId: string

  /** 首次学习时间 (ms 时间戳) */
  firstLearnedAt: number
  /** 最后一次复习时间 (ms 时间戳) */
  lastReviewedAt: number
  /** 下次复习时间 (ms 时间戳) */
  nextReviewAt: number

  /** 复习次数 */
  reviewCount: number
  /** 连续答对次数（用于 SM-2 算法） */
  correctStreak: number
  /** 熟悉度因子（SM-2 的 ease factor，初始 2.5） */
  easeFactor: number
  /** 当前复习间隔（天） */
  intervalDays: number

  /** 掌握程度 0-100 */
  mastery: number

  /** 累计学习时长 (ms) */
  totalStudyTime: number
  /** 累计错误次数 */
  totalErrors: number
  /** 累计正确次数 */
  totalCorrect: number

  /** 历史复习记录（最近 N 条） */
  history: ReviewLog[]
}

/** 单次复习日志 */
export interface ReviewLog {
  /** 时间戳 (ms) */
  at: number
  /** 评分 0-5（SM-2 的 quality） */
  quality: number
  /** 本次耗时 (ms) */
  duration: number
  /** 错误次数 */
  errors: number
}

/** 整体学习统计 */
export interface StudyStats {
  /** 已学习单词总数 */
  totalLearned: number
  /** 今日学习单词数 */
  todayLearned: number
  /** 今日复习单词数 */
  todayReviewed: number
  /** 待复习单词数 */
  dueReviewCount: number
  /** 累计学习时长 (ms) */
  totalStudyTime: number
  /** 今日学习时长 (ms) */
  todayStudyTime: number
  /** 平均掌握程度 */
  averageMastery: number
  /** 连续学习天数 */
  streakDays: number
  /** 各掌握程度区间的单词数 */
  masteryDistribution: { range: string; count: number }[]
  /** 最近 7 天每日学习量 */
  recentActivity: { date: string; learned: number; reviewed: number }[]
}

/** 复习质量评分（SM-2 标准） */
export const ReviewQuality = {
  BLACKOUT: 0,      // 完全不记得
  WRONG_EASY: 1,    // 错了，但看到答案觉得简单
  WRONG_HARD: 2,    // 错了，但看到答案想起来了
  HARD: 3,          // 想起来了，但很费劲
  GOOD: 4,          // 想起来了，略有迟疑
  EASY: 5,          // 瞬间想起
} as const

export type ReviewQualityValue = typeof ReviewQuality[keyof typeof ReviewQuality]

/** 根据打字表现自动评分 */
export function scoreFromTyping(errors: number, totalChars: number, durationMs: number): number {
  if (totalChars === 0) return ReviewQuality.BLACKOUT
  const accuracy = (totalChars - errors) / totalChars
  // 平均每字符耗时（ms），用于判断熟练度
  const avgPerChar = durationMs / totalChars

  if (accuracy >= 0.98 && avgPerChar < 300) return ReviewQuality.EASY
  if (accuracy >= 0.95 && avgPerChar < 500) return ReviewQuality.GOOD
  if (accuracy >= 0.85) return ReviewQuality.HARD
  if (accuracy >= 0.6) return ReviewQuality.WRONG_HARD
  if (accuracy > 0) return ReviewQuality.WRONG_EASY
  return ReviewQuality.BLACKOUT
}
