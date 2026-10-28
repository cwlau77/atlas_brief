import { describe, expect, it } from 'vitest'
import { arcControl, arcPoints, leaderPath, placeCard, sparklinePath, type Box, type Pt } from './layout'

const area: Box = { x: 0, y: 0, w: 1000, h: 600 }
const card = { w: 288, h: 392 }
const bounds: Box = { x: 450, y: 250, w: 100, h: 80 }
const anchor: Pt = [500, 290]

describe('arcs', () => {
  it('raises the midpoint by min(130, 0.35 * distance)', () => {
    expect(arcControl([0, 100], [100, 100])).toEqual([50, 65])
    expect(arcControl([0, 500], [1000, 500])).toEqual([500, 370])
  })
  it('samples from start to end', () => {
    const pts = arcPoints([0, 0], [100, 0], 10)
    expect(pts).toHaveLength(11)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[10]).toEqual([100, 0])
  })
})

describe('placeCard', () => {
  it('prefers the side with fewer hot countries', () => {
    const avoid: Pt[] = [[700, 300], [720, 320], [760, 280]]
    const { side, box } = placeCard({ anchor, bounds, card, area, avoid, arcs: [] })
    expect(side).toBe('r')
    expect(box.x + box.w).toBeLessThanOrEqual(bounds.x)
  })
  it('never covers the arcs when another side is free', () => {
    const arcs = arcPoints(anchor, [800, 300])
    const { box } = placeCard({ anchor, bounds, card, area, avoid: [], arcs })
    const hit = arcs.some(([x, y]) => x > box.x - 16 && x < box.x + box.w + 16 && y > box.y - 16 && y < box.y + box.h + 16)
    expect(hit).toBe(false)
  })
  it('stays inside the area', () => {
    const b: Box = { x: 880, y: 250, w: 100, h: 80 }
    const { box } = placeCard({ anchor: [930, 290], bounds: b, card, area, avoid: [], arcs: [] })
    expect(box.x + box.w).toBeLessThanOrEqual(area.x + area.w)
    expect(box.x).toBeGreaterThanOrEqual(area.x)
    expect(box.y + box.h).toBeLessThanOrEqual(area.y + area.h)
  })
  it('clamps into the area when every candidate is outside', () => {
    const tiny: Box = { x: 0, y: 0, w: 320, h: 400 }
    const { box } = placeCard({ anchor: [160, 200], bounds: { x: 120, y: 160, w: 80, h: 80 }, card, area: tiny, avoid: [], arcs: [] })
    expect(box.x + box.w).toBeLessThanOrEqual(tiny.x + tiny.w)
    expect(box.x).toBeGreaterThanOrEqual(tiny.x)
  })
})

describe('leaderPath', () => {
  it('starts at the anchor and ends on the card edge (left side)', () => {
    const box: Box = { x: 600, y: 100, w: 288, h: 392 }
    expect(leaderPath([500, 290], box, 'l')).toBe('M500,290 L550,156 L600,156')
  })
  it('ends on the right edge for side r', () => {
    const box: Box = { x: 100, y: 100, w: 288, h: 392 }
    expect(leaderPath([500, 290], box, 'r')).toMatch(/L388,156$/)
  })
  it('ends on the top or bottom edge for t and b', () => {
    const box: Box = { x: 356, y: 400, w: 288, h: 100 }
    expect(leaderPath([500, 290], box, 't')).toBe('M500,290 L500,345 L500,400')
    expect(leaderPath([500, 290], box, 'b')).toBe('M500,290 L500,395 L500,500')
  })
})

describe('sparklinePath', () => {
  it('last point is the final value', () => {
    const { last, line, area: a } = sparklinePath([1, 2, 4, 3], 130, 38)
    expect(last[0]).toBe(130)
    const max = 4 * 1.1
    expect(last[1]).toBeCloseTo(38 - 2 - (3 / max) * 32, 5)
    expect(line.startsWith('M0.0,')).toBe(true)
    expect(a.endsWith('L130,38L0,38Z')).toBe(true)
  })
})
