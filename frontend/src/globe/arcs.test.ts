import { describe, expect, it } from 'vitest'
import { ROUTE_COLORS, type Route } from '../lib/routes'
import { makeBriefing } from '../test/fixtures'
import { buildArcs, slerpArc } from './arcs'
import { devAnchor, toVec3, type Vec3 } from './regions'

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z)
const near = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-6

const route = (stops: number[], over: Partial<Route> = {}): Route => ({
  key: 'tension-0', kind: 'tension', i: 0, title: 'A ↔ B', stops, lane: 0, color: ROUTE_COLORS[0], dashed: false, ...over,
})

describe('slerpArc', () => {
  it('runs segments + 1 points from a to b on the unit sphere, lifted at the middle', () => {
    const a = toVec3(12.78, 45.04), b = toVec3(30, 31)
    const pts = slerpArc(a, b, 48, 0.12)
    expect(pts).toHaveLength(49)
    expect(near(pts[0], a)).toBe(true)
    expect(near(pts[48], b)).toBe(true)
    expect(len(pts[0])).toBeCloseTo(1, 6)
    expect(len(pts[48])).toBeCloseTo(1, 6)
    expect(Math.abs(len(pts[24]) - 1.12)).toBeLessThan(0.01)
  })
})

describe('buildArcs', () => {
  // Fixture anchors: dev 0 at Aden (its city), dev 1 at the Red Sea centre, dev 2 at Egypt's centre.
  it('chains the stops in timeline order through each development anchor', () => {
    const b = makeBriefing()
    const [arc] = buildArcs(b, [route([0, 1, 2], { key: 'contradiction-0', dashed: true, color: ROUTE_COLORS[2] })], 48)
    expect(arc).toMatchObject({ key: 'contradiction-0', color: '#5E8A79', dashed: true })
    const [a0, a2] = [devAnchor(b, 0)!, devAnchor(b, 2)!]
    expect(near(arc.points[0], toVec3(a0.lat, a0.lng))).toBe(true)
    expect(near(arc.points.at(-1)!, toVec3(a2.lat, a2.lng))).toBe(true)
    expect(arc.points).toHaveLength(48 * 2 + 1)
  })

  it('skips a segment whose developments share an anchor', () => {
    const b = makeBriefing()
    b.keyDevelopments[1] = { ...b.keyDevelopments[1], place: b.keyDevelopments[0].place }
    const [arc] = buildArcs(b, [route([0, 1, 2])], 48)
    expect(arc.points).toHaveLength(49)
  })

  it('drops a route whose anchors all coincide, or that has fewer than two', () => {
    const b = makeBriefing()
    b.keyDevelopments[1] = { ...b.keyDevelopments[1], place: b.keyDevelopments[0].place }
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['Atlantis'] }
    expect(buildArcs(b, [route([0, 1]), route([0, 2], { key: 'tension-1' })])).toEqual([])
  })
})
