const CJK_CHARACTER = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const LATIN_WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g
const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN')
const CLOCK_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export interface TextStats {
  words: number
  characters: number
  lines: number
}

export function countText(markdown: string): TextStats {
  if (markdown.length === 0) {
    return { words: 0, characters: 0, lines: 0 }
  }

  const cjkCount = markdown.match(CJK_CHARACTER)?.length ?? 0
  const latinCount = markdown.replace(CJK_CHARACTER, ' ').match(LATIN_WORD)?.length ?? 0
  const characters = Array.from(markdown).length
  const lines = markdown.split(/\r\n|\r|\n/).length

  return {
    words: cjkCount + latinCount,
    characters,
    lines
  }
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value)
}

export function formatClock(timestamp: number): string {
  return CLOCK_FORMATTER.format(timestamp)
}
