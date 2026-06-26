// ============================================================
// 三种 JSON 格式的原始类型定义
// ============================================================

/** 简易版 JSON 结构 */
export interface SimpleWord {
  word: string
  translations: { translation: string; type: string }[]
  phrases?: { phrase: string; translation: string }[]
}

/** 带例句版 JSON 结构 */
export interface SentenceWord {
  word: string
  us: string
  uk: string
  translations: { translation: string; type: string }[]
  phrases?: { phrase: string; translation: string }[]
  sentences?: { sentence: string; translation: string }[]
}

/** 详细版 JSON 结构（嵌套较深，所有可选字段都标记 ?） */
export interface FullWord {
  wordRank: number
  headWord: string
  content: {
    word: {
      wordHead: string
      wordId: string
      content: {
        sentence?: { sentences: { sContent: string; sCn: string }[]; desc: string }
        realExamSentence?: {
          sentences: {
            sContent: string
            sourceInfo?: { paper?: string; level?: string; year?: string; type?: string }
          }[]
          desc: string
        }
        usphone?: string
        ukphone?: string
        syno?: { synos: { pos: string; tran: string; hwds: { w: string }[] }[]; desc: string }
        phrase?: { phrases: { pContent: string; pCn: string }[]; desc: string }
        relWord?: { rels: { pos: string; words: { hwd: string; tran: string }[] }[]; desc: string }
        trans?: { tranCn: string; descCn?: string; pos?: string; tranOther?: string }[]
        remMethod?: { val: string; desc: string }
      }
    }
  }
  bookId: string
}

// ============================================================
// 统一的规范化类型（三种格式都转换为此类型供 UI 使用）
// ============================================================

export interface NormalizedWord {
  word: string
  phonetics?: { us?: string; uk?: string }
  translations: { text: string; type?: string }[]
  phrases?: { phrase: string; translation: string }[]
  sentences?: { en: string; cn: string }[]
  realExamSentences?: { en: string; source?: string }[]
  synonyms?: { pos: string; tran: string; words: string[] }[]
  relatedWords?: { pos: string; words: { word: string; tran: string }[] }[]
  memoryMethod?: string
}

// ============================================================
// 版本与词汇书类型
// ============================================================

export type VersionType = 'simple' | 'full' | 'sentence'

export interface BookInfo {
  id: string          // 如 "CET4_1"
  prefix: string      // 如 "CET4"
  category: string    // 如 "大学"
  name: string        // 如 "四级"
  volume: number      // 如 1
  isRandom: boolean   // 是否乱序
  path: string        // glob 路径
}

// ============================================================
// 规范化转换函数
// ============================================================

export function normalizeSimple(raw: SimpleWord[]): NormalizedWord[] {
  return raw.map(w => ({
    word: w.word,
    translations: w.translations.map(t => ({ text: t.translation, type: t.type })),
    phrases: w.phrases?.map(p => ({ phrase: p.phrase, translation: p.translation })),
  }))
}

export function normalizeSentence(raw: SentenceWord[]): NormalizedWord[] {
  return raw.map(w => ({
    word: w.word,
    phonetics: { us: w.us || undefined, uk: w.uk || undefined },
    translations: w.translations.map(t => ({ text: t.translation, type: t.type })),
    phrases: w.phrases?.map(p => ({ phrase: p.phrase, translation: p.translation })),
    sentences: w.sentences?.map(s => ({ en: s.sentence, cn: s.translation })),
  }))
}

export function normalizeFull(raw: FullWord[]): NormalizedWord[] {
  return raw.map(w => {
    const c = w.content.word.content
    const sourceStr = (s: { paper?: string; level?: string; year?: string; type?: string }) =>
      [s.year, s.level, s.type, s.paper].filter(Boolean).join(' · ')

    return {
      word: w.headWord,
      phonetics: { us: c.usphone || undefined, uk: c.ukphone || undefined },
      translations: c.trans?.map(t => ({ text: t.tranCn, type: t.pos })) ?? [],
      phrases: c.phrase?.phrases?.map(p => ({ phrase: p.pContent, translation: p.pCn })),
      sentences: c.sentence?.sentences?.map(s => ({ en: s.sContent, cn: s.sCn })),
      realExamSentences: c.realExamSentence?.sentences?.map(s => ({
        en: s.sContent,
        source: s.sourceInfo ? sourceStr(s.sourceInfo) : undefined,
      })),
      synonyms: c.syno?.synos?.map(s => ({
        pos: s.pos,
        tran: s.tran,
        words: s.hwds?.map(h => h.w) ?? [],
      })),
      relatedWords: c.relWord?.rels?.map(r => ({
        pos: r.pos,
        words: r.words?.map(w => ({ word: w.hwd, tran: w.tran })) ?? [],
      })),
      memoryMethod: c.remMethod?.val,
    }
  })
}
