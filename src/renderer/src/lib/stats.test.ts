import { describe, expect, it } from 'vitest'
import { countText, formatNumber } from './stats'

describe('countText', () => {
  it('returns an empty result for empty documents', () => {
    expect(countText('')).toEqual({ words: 0, characters: 0, lines: 0 })
  })

  it('counts CJK characters and Latin word runs', () => {
    expect(countText('你好，墨页！\nWrite 2 words.')).toEqual({
      words: 7,
      characters: 21,
      lines: 2
    })
  })

  it('counts only CJK glyphs for Chinese prose', () => {
    expect(countText('把想法写下来')).toEqual({
      words: 6,
      characters: 6,
      lines: 1
    })
  })

  it('counts emoji as one character without inflating the word count', () => {
    expect(countText('a😀b')).toEqual({
      words: 2,
      characters: 3,
      lines: 1
    })
  })

  it('handles CRLF and CR line endings', () => {
    expect(countText('a\r\nb\rc\nd').lines).toBe(4)
  })

  it('counts Markdown words pragmatically', () => {
    expect(countText('# Title\n\n- one\n- two').words).toBe(3)
  })
})

describe('formatNumber', () => {
  it('formats counts with locale grouping', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })
})
