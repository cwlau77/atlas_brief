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
  it('lists the five brand colours in assignment order', () => {
    expect(MAX_LANES).toBe(5)
    expect(ROUTE_COLORS).toEqual([
      { token: '--ochre', hex: '#9C7026' },
      { token: '--ink', hex: '#1C231F' },
      { token: '--celadon', hex: '#5E8A79' },
      { token: '--sand', hex: '#C7B89C' },
      { token: '--celadon-deep', hex: '#3A5F52' },
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
    const parts = routeDashArray(20, true).split(' ').map(Number)
    expect(parts.slice(0, 6)).toEqual([5, 4, 5, 4, 5, 4])
    expect(parts.at(-1)).toBe(20)
    expect(parts.slice(0, -1).reduce((a, n) => a + n, 0)).toBeGreaterThanOrEqual(20)
  })
})
