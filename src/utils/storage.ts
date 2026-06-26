// ============================================================
// 学习进度存储层
// 基于 localStorage 持久化，预留云端同步接口
// ============================================================

import type { WordRecord, StudyStats } from '../types/progress'

const STORAGE_KEY = 'keyforge:progress:v1'

interface StorageData {
  records: Record<string, WordRecord>
  /** 每日学习活动记录 date -> { learned, reviewed, studyTime } */
  dailyActivity: Record<string, { learned: number; reviewed: number; studyTime: number }>
}

/** 存储适配器接口，便于后续替换为云端同步 */
export interface StorageAdapter {
  load(): StorageData
  save(data: StorageData): void
}

class LocalStorageAdapter implements StorageAdapter {
  load(): StorageData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { records: {}, dailyActivity: {} }
      const data = JSON.parse(raw) as StorageData
      return {
        records: data.records || {},
        dailyActivity: data.dailyActivity || {},
      }
    } catch {
      return { records: {}, dailyActivity: {} }
    }
  }

  save(data: StorageData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('保存学习进度失败:', e)
    }
  }
}

// 当前使用的适配器（可替换为云端适配器）
let adapter: StorageAdapter = new LocalStorageAdapter()

export function setStorageAdapter(a: StorageAdapter) {
  adapter = a
}

// 内存缓存，避免频繁读写 localStorage
let cache: StorageData | null = null

function getData(): StorageData {
  if (!cache) cache = adapter.load()
  return cache
}

function persist() {
  if (cache) adapter.save(cache)
}

/** 生成单词记录 ID */
export function makeRecordId(version: string, bookId: string, word: string): string {
  return `${version}:${bookId}:${word}`
}

/** 获取单个单词记录 */
export function getRecord(id: string): WordRecord | null {
  return getData().records[id] || null
}

/** 获取所有记录 */
export function getAllRecords(): WordRecord[] {
  return Object.values(getData().records)
}

/** 保存/更新单词记录 */
export function saveRecord(record: WordRecord) {
  const data = getData()
  data.records[record.id] = record
  persist()
}

/** 批量保存 */
export function saveRecords(records: WordRecord[]) {
  const data = getData()
  for (const r of records) data.records[r.id] = r
  persist()
}

/** 记录每日活动 */
export function recordDailyActivity(type: 'learned' | 'reviewed', studyTime: number) {
  const data = getData()
  const today = new Date().toISOString().slice(0, 10)
  if (!data.dailyActivity[today]) {
    data.dailyActivity[today] = { learned: 0, reviewed: 0, studyTime: 0 }
  }
  data.dailyActivity[today][type]++
  data.dailyActivity[today].studyTime += studyTime
  persist()
}

/** 获取指定日期的活动 */
export function getDailyActivity(date: string): { learned: number; reviewed: number; studyTime: number } {
  return getData().dailyActivity[date] || { learned: 0, reviewed: 0, studyTime: 0 }
}

/** 获取所有每日活动 */
export function getAllDailyActivity(): Record<string, { learned: number; reviewed: number; studyTime: number }> {
  return getData().dailyActivity
}

/** 清空所有进度（危险操作） */
export function clearAllProgress() {
  cache = { records: {}, dailyActivity: {} }
  persist()
}

/** 导出进度数据（用于备份/同步） */
export function exportProgress(): string {
  return JSON.stringify(getData())
}

/** 导入进度数据（用于备份恢复/同步） */
export function importProgress(json: string) {
  try {
    const data = JSON.parse(json) as StorageData
    cache = {
      records: data.records || {},
      dailyActivity: data.dailyActivity || {},
    }
    persist()
  } catch (e) {
    console.error('导入进度数据失败:', e)
  }
}

// ============================================================
// 统计计算
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000

/** 计算连续学习天数 */
function calculateStreak(dailyActivity: StorageData['dailyActivity']): number {
  const dates = Object.keys(dailyActivity).sort().reverse()
  if (dates.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today.getTime() - i * DAY_MS)
    const dateStr = checkDate.toISOString().slice(0, 10)
    const activity = dailyActivity[dateStr]
    if (activity && (activity.learned > 0 || activity.reviewed > 0)) {
      streak++
    } else if (i === 0) {
      // 今天还没学习，不算中断
      continue
    } else {
      break
    }
  }
  return streak
}

/** 获取学习统计 */
export function getStudyStats(): StudyStats {
  const data = getData()
  const records = Object.values(data.records)
  const now = Date.now()
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayActivity = data.dailyActivity[todayStr] || { learned: 0, reviewed: 0, studyTime: 0 }

  const dueReviewCount = records.filter(r => r.nextReviewAt <= now).length

  const totalStudyTime = records.reduce((sum, r) => sum + r.totalStudyTime, 0)

  const averageMastery = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.mastery, 0) / records.length)
    : 0

  // 掌握程度分布
  const ranges = [
    { range: '0-20%', min: 0, max: 20 },
    { range: '20-40%', min: 20, max: 40 },
    { range: '40-60%', min: 40, max: 60 },
    { range: '60-80%', min: 60, max: 80 },
    { range: '80-100%', min: 80, max: 101 },
  ]
  const masteryDistribution = ranges.map(r => ({
    range: r.range,
    count: records.filter(rec => rec.mastery >= r.min && rec.mastery < r.max).length,
  }))

  // 最近 7 天活动
  const recentActivity = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart.getTime() - i * DAY_MS)
    const dateStr = d.toISOString().slice(0, 10)
    const act = data.dailyActivity[dateStr] || { learned: 0, reviewed: 0, studyTime: 0 }
    recentActivity.push({
      date: dateStr,
      learned: act.learned,
      reviewed: act.reviewed,
    })
  }

  return {
    totalLearned: records.length,
    todayLearned: todayActivity.learned,
    todayReviewed: todayActivity.reviewed,
    dueReviewCount,
    totalStudyTime,
    todayStudyTime: todayActivity.studyTime,
    averageMastery,
    streakDays: calculateStreak(data.dailyActivity),
    masteryDistribution,
    recentActivity,
  }
}

/** 获取待复习的单词记录（按优先级排序） */
export function getDueReviews(limit?: number): WordRecord[] {
  const now = Date.now()
  const due = Object.values(getData().records)
    .filter(r => r.nextReviewAt <= now)
    .sort((a, b) => {
      // 过期时间越早优先级越高
      if (a.nextReviewAt !== b.nextReviewAt) return a.nextReviewAt - b.nextReviewAt
      // 掌握程度低的优先
      return a.mastery - b.mastery
    })
  return limit ? due.slice(0, limit) : due
}
