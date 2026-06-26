import type { VersionType, BookInfo, NormalizedWord, SimpleWord, SentenceWord, FullWord } from '../types/vocabulary'
import { normalizeSimple, normalizeSentence, normalizeFull } from '../types/vocabulary'

// ============================================================
// 词汇书 JSON 文件通过 public/vocabulary 软链接提供
// 运行时用 fetch() 加载，避免 Vite 构建时 OOM
// ============================================================

const VERSION_DIR: Record<VersionType, string> = {
  simple: 'json-simple',
  full: 'json-full',
  sentence: 'json-sentence',
}

// 所有词汇书文件名（三个版本共享同一套文件名）
const ALL_FILENAMES = [
  'BEC_2', 'BEC_3',
  'BeiShiGaoZhong_1', 'BeiShiGaoZhong_10', 'BeiShiGaoZhong_11', 'BeiShiGaoZhong_2', 'BeiShiGaoZhong_3', 'BeiShiGaoZhong_4', 'BeiShiGaoZhong_5', 'BeiShiGaoZhong_6', 'BeiShiGaoZhong_7', 'BeiShiGaoZhong_8', 'BeiShiGaoZhong_9',
  'CET4_1', 'CET4_2', 'CET4_3', 'CET4luan_1', 'CET4luan_2',
  'CET6_1', 'CET6_2', 'CET6_3', 'CET6luan_1',
  'ChuZhong_2', 'ChuZhong_3', 'ChuZhongluan_2',
  'GMAT_2', 'GMAT_3', 'GMATluan_2',
  'GRE_2', 'GRE_3',
  'GaoZhong_2', 'GaoZhong_3', 'GaoZhongluan_2',
  'IELTS_2', 'IELTS_3', 'IELTSluan_2',
  'KaoYan_1', 'KaoYan_2', 'KaoYan_3', 'KaoYanluan_1',
  'Level4_1', 'Level4_2', 'Level4luan_1', 'Level4luan_2',
  'Level8_1', 'Level8_2', 'Level8luan_2',
  'PEPChuZhong7_1', 'PEPChuZhong7_2', 'PEPChuZhong8_1', 'PEPChuZhong8_2', 'PEPChuZhong9_1',
  'PEPGaoZhong_1', 'PEPGaoZhong_10', 'PEPGaoZhong_11', 'PEPGaoZhong_2', 'PEPGaoZhong_3', 'PEPGaoZhong_4', 'PEPGaoZhong_5', 'PEPGaoZhong_6', 'PEPGaoZhong_7', 'PEPGaoZhong_8', 'PEPGaoZhong_9',
  'PEPXiaoXue3_1', 'PEPXiaoXue3_2', 'PEPXiaoXue4_1', 'PEPXiaoXue4_2', 'PEPXiaoXue5_1', 'PEPXiaoXue5_2', 'PEPXiaoXue6_1', 'PEPXiaoXue6_2',
  'SAT_2', 'SAT_3',
  'TOEFL_2', 'TOEFL_3',
  'WaiYanSheChuZhong_1', 'WaiYanSheChuZhong_2', 'WaiYanSheChuZhong_3', 'WaiYanSheChuZhong_4', 'WaiYanSheChuZhong_5', 'WaiYanSheChuZhong_6',
]

// ============================================================
// 前缀 → 分类 + 中文名 映射
// ============================================================

const PREFIX_MAP: Record<string, { category: string; name: string }> = {
  CET4:              { category: '大学', name: '四级' },
  CET6:              { category: '大学', name: '六级' },
  KaoYan:            { category: '考研', name: '考研' },
  TOEFL:             { category: '留学', name: '托福' },
  IELTS:             { category: '留学', name: '雅思' },
  GRE:               { category: '留学', name: 'GRE' },
  GMAT:              { category: '留学', name: 'GMAT' },
  SAT:               { category: '留学', name: 'SAT' },
  BEC:               { category: '专业', name: '商务英语' },
  Level4:            { category: '专业', name: '专四' },
  Level8:            { category: '专业', name: '专八' },
  PEPGaoZhong:       { category: '高中', name: '人教版·高中' },
  PEPChuZhong7:      { category: '初中', name: '人教版·初中七年级' },
  PEPChuZhong8:      { category: '初中', name: '人教版·初中八年级' },
  PEPChuZhong9:      { category: '初中', name: '人教版·初中九年级' },
  PEPXiaoXue3:       { category: '小学', name: '人教版·小学三年级' },
  PEPXiaoXue4:       { category: '小学', name: '人教版·小学四年级' },
  PEPXiaoXue5:       { category: '小学', name: '人教版·小学五年级' },
  PEPXiaoXue6:       { category: '小学', name: '人教版·小学六年级' },
  BeiShiGaoZhong:    { category: '高中', name: '北师大·高中' },
  WaiYanSheChuZhong: { category: '初中', name: '外研社·初中' },
  ChuZhong:          { category: '初中', name: '初中通用' },
  GaoZhong:          { category: '高中', name: '高中通用' },
}

// 分类显示顺序
const CATEGORY_ORDER = ['小学', '初中', '高中', '大学', '考研', '留学', '专业']

// ============================================================
// 从文件名解析词汇书信息
// ============================================================

function parseBookId(bookId: string): BookInfo | null {
  const parts = bookId.split('_')
  if (parts.length < 2) return null

  const prefixPart = parts[0]
  const volume = parseInt(parts[1]) || 1

  const isRandom = prefixPart.endsWith('luan')
  const prefix = isRandom ? prefixPart.slice(0, -4) : prefixPart

  const mapping = PREFIX_MAP[prefix]
  if (!mapping) return null

  return {
    id: bookId,
    prefix,
    category: mapping.category,
    name: mapping.name,
    volume,
    isRandom,
    path: `${VERSION_DIR.simple}/${bookId}.json`,
  }
}

// ============================================================
// 获取指定版本下所有可用词汇书
// ============================================================

export function getAvailableBooks(_version: VersionType): BookInfo[] {
  const books: BookInfo[] = []

  for (const filename of ALL_FILENAMES) {
    const book = parseBookId(filename)
    if (book) books.push(book)
  }

  // 按分类顺序 → 名称 → 册数 排列
  books.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category)
    const cb = CATEGORY_ORDER.indexOf(b.category)
    if (ca !== cb) return ca - cb
    if (a.name !== b.name) return a.name.localeCompare(b.name, 'zh-CN')
    if (a.isRandom !== b.isRandom) return a.isRandom ? 1 : -1
    return a.volume - b.volume
  })

  return books
}

// ============================================================
// 加载词汇书并规范化
// ============================================================

export async function loadBook(version: VersionType, bookId: string): Promise<NormalizedWord[]> {
  const dir = VERSION_DIR[version]
  const url = `/vocabulary/${dir}/${bookId}.json`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`加载词汇书失败: ${bookId} (${response.status})`)
  }

  const rawData = await response.json()

  switch (version) {
    case 'simple':
      return normalizeSimple(rawData as SimpleWord[])
    case 'sentence':
      return normalizeSentence(rawData as SentenceWord[])
    case 'full':
      return normalizeFull(rawData as FullWord[])
  }
}

// ============================================================
// 版本元信息（供 UI 展示）
// ============================================================

export const VERSION_INFO: Record<VersionType, { label: string; description: string; features: string[] }> = {
  simple: {
    label: '简易版',
    description: '只含词条、释义和短语，适合快速浏览',
    features: ['词条', '释义', '短语'],
  },
  sentence: {
    label: '例句版',
    description: '含音标和例句，适合语境记忆',
    features: ['词条', '音标', '释义', '短语', '例句'],
  },
  full: {
    label: '详细版',
    description: '最全面的信息，含同近词、同根词、记忆法、真题',
    features: ['词条', '音标', '释义', '短语', '例句', '同近词', '同根词', '记忆法', '真题例句'],
  },
}
