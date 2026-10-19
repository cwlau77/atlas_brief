import { describe, expect, it } from 'vitest'
import type { SavedBriefing } from '../lib/normalize'
import { makeBriefing } from '../test/fixtures'
import { buildRegionPoints, decodeLandPoints, devAnchor, toVec3, topRegion } from './regions'

function withoutPlaces(overrides: Partial<SavedBriefing> = {}): SavedBriefing {
  const b = makeBriefing(overrides)
  return { ...b, keyDevelopments: b.keyDevelopments.map((d) => ({ ...d, place: null })) }
}

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
    const points = buildRegionPoints(withoutPlaces())
    expect(points.map((p) => p.name)).toEqual(['Red Sea', 'Egypt', 'South Africa', 'Yemen'])
    expect(points.every((p) => p.kind === 'region')).toBe(true)
    expect(points[0].count).toBe(2)
    expect(points[0].stories.map((s) => s.anchorId)).toEqual(['dev-0', 'dev-1'])
    expect(points[0].stories[0].title).toBe('Drone strike damages tanker near Bab el-Mandeb')
  })
  it('places a development with a city only at its city point', () => {
    const points = buildRegionPoints(makeBriefing())
    const aden = points.find((p) => p.name === 'Aden')
    expect(aden).toMatchObject({ kind: 'city', lat: 12.78, lng: 45.04, count: 1 })
    expect(aden?.stories.map((s) => s.anchorId)).toEqual(['dev-0'])
    const redSea = points.find((p) => p.name === 'Red Sea')
    expect(redSea?.stories.map((s) => s.anchorId)).toEqual(['dev-1'])
    expect(redSea?.count).toBe(1)
  })
  it('omits a region point left with no stories', () => {
    const names = buildRegionPoints(makeBriefing()).map((p) => p.name)
    expect(names).not.toContain('Yemen')
    expect(names).toEqual(['Aden', 'Egypt', 'Red Sea', 'South Africa'])
  })
  it('matches story regions case-insensitively', () => {
    const b = makeBriefing()
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['  egypt '] }
    const egypt = buildRegionPoints(b).find((p) => p.name === 'Egypt')
    expect(egypt?.stories.map((s) => s.anchorId)).toEqual(['dev-2'])
  })
  it('drops regions that cannot be placed', () => {
    const points = buildRegionPoints(withoutPlaces({ regionCounts: { Atlantis: 3, Egypt: 1 } }))
    expect(points.map((p) => p.name)).toEqual(['Egypt'])
  })
  it('returns no points when no region resolves', () => {
    const points = buildRegionPoints(withoutPlaces({ regionCounts: { Atlantis: 2, Narnia: 1 } }))
    expect(points).toEqual([])
    expect(topRegion(points)).toBeNull()
  })
})

describe('devAnchor', () => {
  it('uses the city first, then the first resolvable region centre, else null', () => {
    const b = makeBriefing()
    expect(devAnchor(b, 0)).toEqual({ lat: 12.78, lng: 45.04 })
    const egypt = devAnchor(b, 2)
    expect(egypt).not.toBeNull()
    expect(egypt!.lat).toBeGreaterThan(20); expect(egypt!.lat).toBeLessThan(32)
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['Atlantis', 'Egypt'] }
    expect(devAnchor(b, 2)).toEqual(egypt)
    b.keyDevelopments[2] = { ...b.keyDevelopments[2], regions: ['Atlantis'] }
    expect(devAnchor(b, 2)).toBeNull()
    expect(devAnchor(b, 99)).toBeNull()
  })
})
