import { describe, expect, it } from 'vitest'
import { initialLedger, reduceLedger, type LedgerState, type StreamEvent } from './ledger'

const run = (events: (StreamEvent | { type: 'cold' } | { type: 'fallback' })[]): LedgerState =>
  events.reduce(reduceLedger, initialLedger('Sudan ceasefire talks'))

const SOURCES = ['newsapi', 'gdelt', 'rss', 'google_news', 'guardian', 'gnews', 'newsdata', 'tavily', 'exa']
const plan: StreamEvent = { type: 'plan', place: 'Sudan', queries: 5, is_finance: false, sources: SOURCES }

describe('reduceLedger', () => {
  it('starts streaming with nothing known', () => {
    const s = initialLedger('Sudan ceasefire talks')
    expect(s).toMatchObject({ focus: 'Sudan ceasefire talks', coldStart: false, streaming: true, plan: null, ranked: null, articles: 0 })
  })

  it('records the plan and clears the cold-start note', () => {
    const s = run([{ type: 'cold' }, plan])
    expect(s.plan).toEqual({ place: 'Sudan', queries: 5, sources: SOURCES })
    expect(s.coldStart).toBe(false)
  })

  it('keeps a null place', () => {
    expect(run([{ ...plan, place: null } as StreamEvent]).plan?.place).toBeNull()
  })

  it('tallies sources, articles and outlets; the newsroom feeds fill feedOutlets', () => {
    const s = run([
      plan,
      { type: 'source', name: 'rss', count: 6, status: 'ok', outlets: { BBC: 4, 'Al Jazeera': 2 } },
      { type: 'source', name: 'guardian', count: 34, status: 'ok', outlets: { 'The Guardian': 30, BBC: 4 } },
    ])
    expect(Object.values(s.sources).filter(Boolean).length).toBe(2)
    expect(s.plan?.sources.length).toBe(9)
    expect(s.articles).toBe(40)
    expect([...s.outlets].sort()).toEqual(['Al Jazeera', 'BBC', 'The Guardian'])
    expect(s.feedOutlets).toEqual({ BBC: 4, 'Al Jazeera': 2 })
    expect(s.sources.rss).toEqual({ count: 6, status: 'ok' })
  })

  it('records ranking and each written section', () => {
    const s = run([
      plan,
      { type: 'ranked', merged: 214, deduped: 190, kept: 58, outlets: 63 },
      { type: 'section', name: 'developments' },
      { type: 'section', name: 'alerts' },
    ])
    expect(s.ranked).toEqual({ merged: 214, kept: 58, outlets: 63 })
    expect([...s.sections].sort()).toEqual(['alerts', 'developments'])
  })

  it('records the outlook section', () => {
    expect([...run([plan, { type: 'section', name: 'outlook' }]).sections]).toEqual(['outlook'])
  })

  it('shows the cold-start note only while no event has arrived', () => {
    expect(run([{ type: 'cold' }]).coldStart).toBe(true)
    expect(run([plan, { type: 'cold' }]).coldStart).toBe(false)
  })

  it('stops streaming on fallback', () => {
    expect(run([{ type: 'fallback' }]).streaming).toBe(false)
  })
})
