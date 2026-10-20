import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { ViewDevelopment } from './normalize'
import { linkBriefing, linksByDevelopment, mentionsRegion, sortDevelopments } from './timeline'

const dev = (timestamp: string, title = timestamp): ViewDevelopment => ({
  title, content: '', historicalContext: '', priority: 'low', regions: [], sources: [], timestamp, leadImage: null, place: null, commonsImage: null,
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

describe('linksByDevelopment', () => {
  it('maps each development to its tensions, then contradictions', () => {
    expect(linksByDevelopment(linkBriefing(makeBriefing()))).toEqual(new Map([
      [0, [{ kind: 'tension', i: 0, key: 'tension-0' }, { kind: 'contradiction', i: 0, key: 'contradiction-0' }]],
      [2, [{ kind: 'tension', i: 1, key: 'tension-1' }]],
    ]))
  })
})
