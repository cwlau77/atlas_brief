import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { SavedBriefing } from './normalize'
import { MAX_LANES } from './routes'
import { buildTensionIndex, connectionLabel, CONTRADICTION_RELATION, RELATIONSHIP_LABELS, type IndexItem } from './tensionIndex'
import { sortDevelopments, sortNewestFirst } from './timeline'

// Fixture rows: dev 0 (Yemen, Red Sea), dev 1 (Red Sea, South Africa), dev 2 (Egypt).
const tension = (description: string, actors = 'A ↔ B') => ({ actors, level: 'medium' as const, description, sources: [], relatedDevelopments: null })
const contradiction = (topic: string, a = 'a', b = 'b') => ({ topic, account_a: a, account_b: b, sources_a: [], sources_b: [], relatedDevelopments: null })
const indexFor = (b: SavedBriefing) => buildTensionIndex(b, sortDevelopments(b.keyDevelopments))

describe('buildTensionIndex', () => {
  it('sorts by link count then kind then index', () => {
    const b = makeBriefing({
      emergingTensions: [tension('Egypt alone.'), tension('Red Sea only.'), tension('Yemen, Red Sea and Egypt.')],
      contradictions: [contradiction('Red Sea only'),contradiction('Egypt only')],
    })
    expect(indexFor(b).map((i) => [i.key, i.devs.length])).toEqual([
      ['tension-2', 3],
      ['tension-1', 2],
      ['contradiction-0', 2],
      ['tension-0', 1],
      ['contradiction-1', 1],
    ])
  })

  it('contradiction why joins both accounts', () => {
    const b = makeBriefing({
      emergingTensions: [tension('Red Sea strain.', 'Houthis ↔ Coalition')],
      contradictions: [contradiction('Tanker damage', 'Minor.', 'Breach.')],
    })
    const items = indexFor(b)
    const c = items.find((i) => i.kind === 'contradiction')
    expect(c).toMatchObject({ sides: 'Tanker damage', why: 'Minor. / Breach.' })
    const t = items.find((i) => i.kind === 'tension')
    expect(t).toMatchObject({ sides: 'Houthis and Coalition', why: 'Red Sea strain.' })
  })

  it('colour only for lane holders', () => {
    const b = makeBriefing({
      emergingTensions: Array.from({ length: MAX_LANES + 1 }, () => tension('Yemen, Red Sea and Egypt.')),
      contradictions: [],
    })
    const items = indexFor(b)
    expect(items).toHaveLength(MAX_LANES + 1)
    expect(items.slice(0, MAX_LANES).every((i) => i.color !== null)).toBe(true)
    expect(items[MAX_LANES].color).toBeNull()
  })

  it('keeps unmatched items with empty devs', () => {
    const b = makeBriefing({ emergingTensions: [tension('Nothing relevant here.')], contradictions: [] })
    expect(indexFor(b)).toEqual([
      { key: 'tension-0', kind: 'tension', sides: 'A and B', why: 'Nothing relevant here.', devs: [], color: null, relation: null, linked: [] },
    ])
  })

  it('empty briefing yields no index items', () => {
    expect(indexFor(makeBriefing({ emergingTensions: [], contradictions: [] }))).toEqual([])
  })
})

describe('connectionLabel', () => {
  const item = (kind: IndexItem['kind'], devs: number[]): IndexItem =>
    ({ key: `${kind}-0`, kind, sides: '', why: '', devs, color: null, relation: null, linked: [] })

  it('pluralises and joins', () => {
    expect(connectionLabel([item('tension', [0])], 0)).toBe('1 tension')
    expect(connectionLabel([item('tension', [0]), item('tension', [0, 1])], 0)).toBe('2 tensions')
    expect(connectionLabel([item('tension', [0]), item('contradiction', [0])], 0)).toBe('1 tension · 1 contradiction')
    expect(connectionLabel([item('tension', [1])], 0)).toBeNull()
  })
})

describe('index rows say the relationship and name their developments', () => {
  const byKey = (items: IndexItem[], key: string) => items.find((i) => i.key === key)!

  it('names linked developments in timeline order', () => {
    const b = makeBriefing({ emergingTensions: [{ ...tension('t'), relatedDevelopments: [0, 2] }], contradictions: [] })
    const order = sortNewestFirst(b.keyDevelopments)
    const [item] = buildTensionIndex(b, order)
    const expected = order.filter((e) => e.index === 0 || e.index === 2).map((e) => e.index)
    expect(item.linked.map((l) => l.dev)).toEqual(expected)
    expect(item.linked[0]).toEqual({ dev: expected[0], title: b.keyDevelopments[expected[0]].title, timestamp: b.keyDevelopments[expected[0]].timestamp })
  })

  it('relation is the label for a tension and fixed for a contradiction', () => {
    const b = makeBriefing({
      emergingTensions: [{ ...tension('t'), relationship: 'competing_claims' as const }, tension('u')],
      contradictions: [contradiction('c')],
    })
    const items = indexFor(b)
    expect(byKey(items, 'tension-0').relation).toBe('Competing claims')
    expect(byKey(items, 'tension-1').relation).toBeNull()
    expect(byKey(items, 'contradiction-0').relation).toBe('Same event, different accounts')
  })

  it('has words for every relationship', () => {
    expect(RELATIONSHIP_LABELS).toEqual({
      in_conflict: 'In open conflict',
      rivalry: 'Rivals, no clash yet',
      competing_claims: 'Competing claims',
      pressure: 'Pressure and pushback',
      negotiating: 'Negotiating',
      uneasy_partners: 'Uneasy partners',
    })
    expect(CONTRADICTION_RELATION).toBe('Same event, different accounts')
  })

  it('legacy arrow actors become words in sides', () => {
    const b = makeBriefing({ emergingTensions: [tension('t', 'A ↔ B')], contradictions: [] })
    expect(indexFor(b)[0].sides).toBe('A and B')
  })
})
