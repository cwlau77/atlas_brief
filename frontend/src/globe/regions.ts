// Pure geometry and briefing-to-globe mapping. No three.js here: this module is
// imported by the Story tab in the main chunk.
import { resolveRegion } from '../lib/centroids'
import type { SavedBriefing } from '../lib/normalize'
import type { SourceCitation } from '../lib/types'

export interface Vec3 { x: number; y: number; z: number }

export interface RegionStory {
  anchorId: string
  title: string
  timestamp: string
  sources: SourceCitation[]
}

export interface RegionPoint {
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

export function buildRegionPoints(b: Pick<SavedBriefing, 'regionCounts' | 'keyDevelopments'>): RegionPoint[] {
  const points: RegionPoint[] = []
  for (const [name, count] of Object.entries(b.regionCounts)) {
    const geo = resolveRegion(name)
    if (!geo || count <= 0) continue
    const key = name.trim().toLowerCase()
    const stories = b.keyDevelopments.flatMap((d, i) =>
      d.regions.some((r) => r.trim().toLowerCase() === key)
        ? [{ anchorId: `dev-${i}`, title: d.title, timestamp: d.timestamp, sources: d.sources }]
        : [])
    points.push({ name, lat: geo.lat, lng: geo.lng, count, stories })
  }
  return points.sort((a, z) => z.count - a.count || a.name.localeCompare(z.name))
}

export function topRegion(points: RegionPoint[]): RegionPoint | null {
  return points[0] ?? null
}
