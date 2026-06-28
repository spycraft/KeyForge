/**
 * 学习位置记忆功能
 * 记录用户当前学习的单词位置、已学习单词列表等
 * 支持关闭应用后从上次停止的位置继续学习
 */

export interface LearningProgress {
  /** 词汇书标识：version:bookId */
  bookKey: string
  /** 当前学习的单词索引 */
  currentIndex: number
  /** 已学习完成的单词索引列表 */
  completedIndices: number[]
  /** 最后学习时间 (ms) */
  lastStudiedAt: number
  /** 笔记信息 */
  note?: string
}

const STORAGE_KEY = 'keyforge_learning_progress'

/**
 * 获取所有学习进度
 */
export function getAllProgress(): Record<string, LearningProgress> {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * 获取指定词汇书的学习进度
 */
export function getProgress(version: string, bookId: string): LearningProgress | null {
  const all = getAllProgress()
  const key = `${version}:${bookId}`
  return all[key] ?? null
}

/**
 * 保存学习进度
 */
export function saveProgress(
  version: string,
  bookId: string,
  currentIndex: number,
  completedIndices: number[]
): void {
  const all = getAllProgress()
  const key = `${version}:${bookId}`
  
  all[key] = {
    bookKey: key,
    currentIndex,
    completedIndices,
    lastStudiedAt: Date.now(),
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('Failed to save progress:', e)
  }
}

/**
 * 清除指定词汇书的学习进度
 */
export function clearProgress(version: string, bookId: string): void {
  const all = getAllProgress()
  const key = `${version}:${bookId}`
  delete all[key]
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('Failed to clear progress:', e)
  }
}

/**
 * 标记单词为已完成
 */
export function markWordCompleted(
  version: string,
  bookId: string,
  index: number
): void {
  const progress = getProgress(version, bookId)
  
  if (!progress) {
    // 新建进度记录
    saveProgress(version, bookId, 0, [index])
  } else {
    // 添加到已完成列表（去重）
    if (!progress.completedIndices.includes(index)) {
      const completed = [...progress.completedIndices, index]
      saveProgress(version, bookId, progress.currentIndex, completed)
    }
  }
}

/**
 * 更新当前学习位置
 */
export function updateCurrentPosition(
  version: string,
  bookId: string,
  index: number
): void {
  const progress = getProgress(version, bookId)
  
  if (!progress) {
    saveProgress(version, bookId, index, [])
  } else {
    saveProgress(version, bookId, index, progress.completedIndices)
  }
}

/**
 * 导出所有学习进度（用于备份）
 */
export function exportProgress(): string {
  return JSON.stringify(getAllProgress(), null, 2)
}

/**
 * 导入学习进度（用于恢复）
 */
export function importProgress(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData)
    if (typeof data === 'object' && data !== null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      return true
    }
    return false
  } catch {
    return false
  }
}
