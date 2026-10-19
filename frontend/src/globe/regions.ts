// Pure geometry and briefing-to-globe mapping. No three.js here: this module is
// imported by the Story tab in the main chunk.
import { resolveRegion } from '../lib/centroids'
import type { SavedBriefing, ViewDevelopment } from '../lib/normalize'
import type { SourceCitation } from '../lib/types'

export interface Vec3 { x: number; y: number; z: number }

export interface RegionStory {
  anchorId: string
  title: string
  timestamp: string
  sources: SourceCitation[]
}

export interface RegionPoint {
  kind: 'region' | 'city'
  name: string
  lat: number
  lng: number
  count: number
  stories: RegionStory[]
}

const DEG = Math.PI / 180

export function toVec3(lat: number, lng: number, r = 1): Vec3 {
  const la = lat * DEG, lo = lng * DEG
  return { x: Math.cos(la) * Math.sin(lo) * r, y: Math.sin(la) * r, z: Math.cos(la) * Math.cos(lo) * r }
}

export function decodeLandPoints(b64: string): Float32Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ll = new Int16Array(bytes.buffer)
  const out = new Float32Array((ll.length / 2) * 3)
  for (let i = 0, j = 0; i < ll.length; i += 2, j += 3) {
    const v = toVec3(ll[i] / 100, ll[i + 1] / 100)
    out[j] = v.x; out[j + 1] = v.y; out[j + 2] = v.z
  }
  return out
}

function storyOf(d: ViewDevelopment, i: number): RegionStory {
  return { anchorId: `dev-${i}`, title: d.title, timestamp: d.timestamp, sources: d.sources }
}

/**
 * One point per named city, then one per resolvable region. A development with
 * a city sits only at its city point, so a carousel never repeats a story
 * across neighbouring points; region counts drop by those developments.
 */
export function buildRegionPoints(b: Pick<SavedBriefing, 'regionCounts' | 'keyDevelopments'>): RegionPoint[] {
  const points: RegionPoint[] = []
  const cities = new Map<string, RegionPoint>()
  b.keyDevelopments.forEach((d, i) => {
    if (!d.place) return
    const key = `${d.place.name}|${d.place.country}`
    let city = cities.get(key)
    if (!city) {
      city = { kind: 'city', name: d.place.name, lat: d.place.lat, lng: d.place.lng, count: 0, stories: [] }
      cities.set(key, city)
      points.push(city)
    }
    city.stories.push(storyOf(d, i))
    city.count = city.stories.length
  })
  for (const [name, total] of Object.entries(b.regionCounts)) {
    const geo = resolveRegion(name)
    if (!geo || total <= 0) continue
    const key = name.trim().toLowerCase()
    const inRegion = b.keyDevelopments.flatMap((d, i) =>
      d.regions.some((r) => r.trim().toLowerCase() === key) ? [{ d, i }] : [])
    const stories = inRegion.filter(({ d }) => !d.place).map(({ d, i }) => storyOf(d, i))
    const count = total - (inRegion.length - stories.length)
    if (count <= 0 && stories.length === 0) continue
    points.push({ kind: 'region', name, lat: geo.lat, lng: geo.lng, count, stories })
  }
  return points.sort((a, z) => z.count - a.count || a.name.localeCompare(z.name))
}

/** Where a development sits for arcs: its city, else its first resolvable region's centre. */
export function devAnchor(b: Pick<SavedBriefing, 'keyDevelopments'>, devIndex: number): { lat: number; lng: number } | null {
  const d = b.keyDevelopments[devIndex]
  if (!d) return null
  if (d.place) return { lat: d.place.lat, lng: d.place.lng }
  for (const region of d.regions) {
    const geo = resolveRegion(region)
    if (geo) return { lat: geo.lat, lng: geo.lng }
  }
  return null
}

/** Unique per point: a city and a region can share a name (Gaza, Singapore). */
export function pointKey(p: Pick<RegionPoint, 'kind' | 'name'>): string {
  return `${p.kind}:${p.name}`
}

export function topRegion(points: RegionPoint[]): RegionPoint | null {
  return points[0] ?? null
}
