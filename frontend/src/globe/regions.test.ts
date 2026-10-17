import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { buildRegionPoints, decodeLandPoints, toVec3, topRegion } from './regions'

function encode(values: number[]): string {
  const bytes = new Uint8Array(new Int16Array(values).buffer)
  let s = ''
  bytes.forEach((b) => { s += String.fromCharCode(b) })
  return btoa(s)
}

describe('toVec3', () => {
  it('puts lat 0, lng 0 on +z and the north pole on +y', () => {
    const a = toVec3(0, 0)
    expect(a.x).toBeCloseTo(0); expect(a.y).toBeCloseTo(0); expect(a.z).toBeCloseTo(1)
    const n = toVec3(90, 0)
    expect(n.y).toBeCloseTo(1)
  })
  it('puts lng 90 on +x', () => {
    expect(toVec3(0, 90).x).toBeCloseTo(1)
  })
})

describe('decodeLandPoints', () => {
  it('decodes packed lat/lng pairs into unit vectors', () => {
    const out = decodeLandPoints(encode([1000, 2000, -4500, 17999]))
    expect(out).toHaveLength(6)
    const first = toVec3(10, 20)
    expect(out[0]).toBeCloseTo(first.x); expect(out[1]).toBeCloseTo(first.y); expect(out[2]).toBeCloseTo(first.z)
    const second = toVec3(-45, 179.99)
    expect(out[3]).toBeCloseTo(second.x); expect(out[5]).toBeCloseTo(second.z)
  })
})

describe('buildRegionPoints', () => {
  it('maps resolvable regions with their stories, busiest first', () => {
    const points = buildRegionPoints(makeBriefing())
    expect(points.map((p) => p.name)).toEqual(['Red Sea', 'Egypt', 'South Africa', 'Yemen'])
    expect(points[0].count).toBe(2)
    expect(points[0].stories.map((s) => s.anchorId)).toEqual(['dev-0', 'dev-1'])
    expect(points[0].stories[0].title).toBe('Drone strike damages tanker near Bab el-Mandeb')
  })
  it('matches story regions case-insensitively', () => {
    const b = makeBriefing()
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['  egypt '] }
    const egypt = buildRegionPoints(b).find((p) => p.name === 'Egypt')
    expect(egypt?.stories.map((s) => s.anchorId)).toEqual(['dev-2'])
  })
  it('drops regions that cannot be placed', () => {
    const points = buildRegionPoints(makeBriefing({ regionCounts: { Atlantis: 3, Egypt: 1 } }))
    expect(points.map((p) => p.name)).toEqual(['Egypt'])
  })
  it('returns no points when no region resolves', () => {
    const points = buildRegionPoints(makeBriefing({ regionCounts: { Atlantis: 2, Narnia: 1 } }))
    expect(points).toEqual([])
    expect(topRegion(points)).toBeNull()
  })
})
