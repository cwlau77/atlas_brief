import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { ViewDevelopment } from './normalize'
import { linkBriefing, mentionsRegion, sortDevelopments, sortNewestFirst } from './timeline'

const dev = (timestamp: string, title = timestamp): ViewDevelopment => ({
  title, content: '', historicalContext: '', priority: 'low', regions: [], sources: [], timestamp, leadImage: null, place: null, commonsImage: null, keyFigures: [],
})

describe('sortDevelopments', () => {
  it('orders by time, oldest first, keeping original indexes', () => {
    const order = sortDevelopments([dev('2026-10-16T09:00:00Z'), dev('2026-10-16T03:00:00Z'), dev('2026-10-16T06:00:00Z')])
    expect(order.map((e) => e.index)).toEqual([1, 2, 0])
  })
  it('puts missing or invalid timestamps last in original order', () => {
    const order = sortDevelopments([dev(''), dev('2026-10-16T06:00:00Z'), dev('garbage'), dev('2026-10-16T01:00:00Z')])
    expect(order.map((e) => e.index)).toEqual([3, 1, 0, 2])
    expect(order[2].time).toBeNull()
  })
  it('keeps original order for equal times', () => {
    const t = '2026-10-16T06:00:00Z'
    expect(sortDevelopments([dev(t, 'a'), dev(t, 'b')]).map((e) => e.dev.title)).toEqual(['a', 'b'])
  })
})

describe('sortNewestFirst', () => {
  it('orders newest first with untimed entries last in original order', () => {
    const order = sortNewestFirst([dev(''), dev('2026-10-16T01:00:00Z'), dev('garbage'), dev('2026-10-16T06:00:00Z')])
    expect(order.map((e) => e.index)).toEqual([3, 1, 0, 2])
  })
  it('keeps original order for equal times', () => {
    const t = '2026-10-16T06:00:00Z'
    expect(sortNewestFirst([dev(t, 'a'), dev(t, 'b')]).map((e) => e.dev.title)).toEqual(['a', 'b'])
  })
})

describe('mentionsRegion', () => {
  it('matches whole words case-insensitively', () => {
    expect(mentionsRegion('Strike off yemen today', 'Yemen')).toBe(true)
    expect(mentionsRegion('Talks in Tirana', 'Iran')).toBe(false)
  })
  it('handles regex characters in region names', () => {
    expect(mentionsRegion('A U.S. destroyer responded', 'U.S.')).toBe(true)
    expect(mentionsRegion('US forces', 'U.S.')).toBe(false)
    expect(() => mentionsRegion('anything', 'a(b')).not.toThrow()
  })
  it('handles diacritics and punctuation around the name', () => {
    expect(mentionsRegion("Exports from Côte d'Ivoire rose", "Côte d'Ivoire")).toBe(true)
    expect(mentionsRegion('Aid convoy (Gaza) delayed', 'Gaza')).toBe(true)
  })
  it('never matches an empty region', () => {
    expect(mentionsRegion('anything', '  ')).toBe(false)
    expect(mentionsRegion('', 'Egypt')).toBe(false)
  })
})

describe('linkBriefing', () => {
  it('links tensions and contradictions to developments sharing a region', () => {
    expect(linkBriefing(makeBriefing())).toEqual({
      tensions: [[0], [2], []],
      contradictions: [[0]],
    })
  })
  it('links one item to several developments', () => {
    const b = makeBriefing()
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    expect(linkBriefing(b).tensions[0]).toEqual([0, 1])
  })
})

describe('linkBriefing with explicit links', () => {
  const withTension = (relatedDevelopments: number[] | null) => {
    const b = makeBriefing()
    b.keyDevelopments[0] = { ...b.keyDevelopments[0], regions: ['United States'] }
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'United States presses allies.', relatedDevelopments }
    return b
  }
  it('prefers explicit links over region matching', () => {
    expect(linkBriefing(withTension([1])).tensions[0]).toEqual([1])
  })
  it('respects an explicit empty list', () => {
    expect(linkBriefing(withTension([])).tensions[0]).toEqual([])
  })
  it('drops out-of-range and duplicate explicit indexes', () => {
    expect(linkBriefing(withTension([2, 0, 0, -1, 9])).tensions[0]).toEqual([2, 0])
  })
  it('falls back to region matching when null', () => {
    expect(linkBriefing(withTension(null)).tensions[0]).toEqual([0])
  })
  it('applies the same rules to contradictions', () => {
    const b = makeBriefing()
    b.contradictions[0] = { ...b.contradictions[0], relatedDevelopments: [2] }
    expect(linkBriefing(b).contradictions[0]).toEqual([2])
    b.contradictions[0] = { ...b.contradictions[0], relatedDevelopments: null }
    expect(linkBriefing(b).contradictions[0]).toEqual([0])
  })
})
