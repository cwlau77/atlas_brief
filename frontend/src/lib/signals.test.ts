import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { SOURCE_LABELS, shares, summarizeSignals, topEntries } from './signals'

describe('shares', () => {
  it('returns labeled shares that sum to 100', () => {
    const s = shares({ newsapi: 98, gdelt: 66, rss: 50 }, SOURCE_LABELS)
    expect(s.map((x) => [x.label, x.count, x.pct])).toEqual([
      ['NewsAPI', 98, 46], ['GDELT', 66, 31], ['Wire feeds', 50, 23],
    ])
  })
  it('fixes rounding so thirds still sum to 100', () => {
    const s = shares({ a: 1, b: 1, c: 1 })
    expect(s.reduce((t, x) => t + x.pct, 0)).toBe(100)
  })
  it('drops zero and negative counts and handles empty input', () => {
    expect(shares({ a: 0, b: -2 })).toEqual([])
    expect(shares({})).toEqual([])
  })
  it('breaks count ties by label', () => {
    expect(shares({ zeta: 2, alpha: 2 }).map((x) => x.label)).toEqual(['alpha', 'zeta'])
  })
})

describe('SOURCE_LABELS', () => {
  it('labels every backend source type', () => {
    for (const key of ['newsapi', 'gdelt', 'rss', 'google_news', 'guardian', 'gnews', 'newsdata',
      'brave', 'tavily', 'exa', 'finnhub', 'marketaux', 'alphavantage']) {
      expect(SOURCE_LABELS[key]).toBeTruthy()
    }
    expect(SOURCE_LABELS.google_news).toBe('Google News')
    expect(SOURCE_LABELS.alphavantage).toBe('Alpha Vantage')
  })
})

describe('topEntries', () => {
  it('returns the n largest positive entries', () => {
    expect(topEntries({ a: 1, b: 5, c: 0, d: 3 }, 2)).toEqual([['b', 5], ['d', 3]])
  })
})

describe('summarizeSignals', () => {
  it('names the top region and leading source type', () => {
    expect(summarizeSignals(makeBriefing())).toBe(
      'Coverage is concentrated on Red Sea, with 40% of regional mentions, and NewsAPI supplied 46% of articles.',
    )
  })
  it('handles a single region', () => {
    expect(summarizeSignals({ regionCounts: { Egypt: 3 }, sourceBreakdown: {} })).toBe('Every regional mention in this briefing is of Egypt.')
  })
  it('handles sources without regions', () => {
    expect(summarizeSignals({ regionCounts: {}, sourceBreakdown: { gdelt: 3, rss: 1 } })).toBe('GDELT supplied 75% of the 4 articles.')
  })
  it('handles empty and all-zero data without NaN', () => {
    const text = summarizeSignals({ regionCounts: { X: 0 }, sourceBreakdown: { newsapi: 0 } })
    expect(text).toBe('This briefing has no regional or source data to summarize.')
    expect(text).not.toContain('NaN')
  })
})
