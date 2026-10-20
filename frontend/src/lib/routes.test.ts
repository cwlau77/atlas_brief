import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import type { SavedBriefing } from './normalize'
import { buildRoutes, MAX_LANES, ROUTE_COLORS, routeDashArray } from './routes'
import { sortDevelopments } from './timeline'

const routesFor = (b: SavedBriefing, order = sortDevelopments(b.keyDevelopments)) => buildRoutes(b, order)

// Fixture rows: dev 0 (Yemen, Red Sea, 02:10), dev 1 (Red Sea, South Africa, 05:45), dev 2 (Egypt, 14:32).
const tension = (description: string) => ({ actors: 'A ↔ B', level: 'medium' as const, description, sources: [] })
const contradiction = (topic: string) => ({ topic, account_a: 'a', account_b: 'b', sources_a: [], sources_b: [] })

describe('ROUTE_COLORS', () => {
  it('lists the five route colours in assignment order', () => {
    expect(MAX_LANES).toBe(5)
    expect(ROUTE_COLORS).toEqual([
      { token: '--route-1', hex: '#1F3FE0' },
      { token: '--route-2', hex: '#0E1116' },
      { token: '--route-3', hex: '#0B7FA8' },
      { token: '--route-4', hex: '#717985' },
      { token: '--route-5', hex: '#5A73EA' },
    ])
  })
})

describe('buildRoutes', () => {
  it('makes routes only from items linked to two or more developments, stops in timeline order', () => {
    const b = makeBriefing({
      emergingTensions: [tension('Red Sea escorts strained.'), tension('Egypt alone.')],
      contradictions: [contradiction('Egypt versus South Africa tolls')],
    })
    const { routes } = routesFor(b)
    expect(routes.map((r) => [r.key, r.stops])).toEqual([['tension-0', [0, 1]], ['contradiction-0', [1, 2]]])
    const reversed = routesFor(b, sortDevelopments(b.keyDevelopments).reverse()).routes
    expect(reversed.find((r) => r.key === 'tension-0')?.stops).toEqual([1, 0])
  })

  it('assigns lanes busiest first, tension before contradiction on ties, then by index', () => {
    const b = makeBriefing({
      emergingTensions: [tension('Yemen and Egypt.'), tension('Red Sea, Egypt.')],
      contradictions: [contradiction('South Africa or Egypt')],
    })
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['Egypt', 'Red Sea'] }
    const { routes, colorFor } = routesFor(b)
    // tension-1 links 0, 1, 2 (three stops); tension-0 and contradiction-0 have two each.
    expect(routes.map((r) => [r.key, r.lane])).toEqual([['tension-1', 0], ['tension-0', 1], ['contradiction-0', 2]])
    expect(routes.map((r) => r.color)).toEqual(ROUTE_COLORS.slice(0, 3))
    expect(routes.map((r) => r.dashed)).toEqual([false, false, true])
    expect(colorFor.get('contradiction-0')).toEqual(ROUTE_COLORS[2])
    expect(routes[0]).toMatchObject({ kind: 'tension', i: 1, title: 'A ↔ B' })
    expect(routes[2]).toMatchObject({ kind: 'contradiction', i: 0, title: 'South Africa or Egypt' })
  })

  it('gives lanes to the busiest five and leaves the sixth as a tab only', () => {
    const b = makeBriefing({ emergingTensions: Array.from({ length: 6 }, () => tension('Red Sea traffic.')), contradictions: [] })
    const { routes, colorFor } = routesFor(b)
    expect(routes.map((r) => r.key)).toEqual(['tension-0', 'tension-1', 'tension-2', 'tension-3', 'tension-4'])
    expect(colorFor.has('tension-5')).toBe(false)
  })

  it('has no routes when every item links a single development', () => {
    const { routes, colorFor } = routesFor(makeBriefing())
    expect(routes).toEqual([])
    expect(colorFor.size).toBe(0)
  })
})

describe('routeDashArray', () => {
  it('draws solid routes as one dash the length of the segment', () => {
    expect(routeDashArray(100, false)).toBe('100 100')
  })
  it('repeats the dash pattern over the segment, then one long gap to hide it while undrawn', () => {
    for (const len of [20, 23, 101]) {
      const parts = routeDashArray(len, true).split(' ').map(Number)
      // An odd list repeats, turning the closing gap into a dash: the count must be even.
      expect(parts.length % 2).toBe(0)
      expect(parts.slice(0, 4)).toEqual([5, 4, 5, 4])
      // The dashes cover exactly the segment; then a gap as long as the segment hides it at offset = len.
      expect(parts.slice(0, -1).reduce((a, n) => a + n, 0)).toBe(len)
      expect(parts.at(-1)).toBe(len)
    }
  })
})
