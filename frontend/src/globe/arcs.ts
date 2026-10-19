// Globe arcs for routes: great-circle curves between the places of a route's
// stories, in timeline order. Pure geometry; the engine does the drawing.
import type { SavedBriefing } from '../lib/normalize'
import type { Route } from '../lib/routes'
import { devAnchor, toVec3, type Vec3 } from './regions'

export interface GlobeArc { key: string; color: string; dashed: boolean; points: Vec3[] }

// A short hop gets a proportionally lower lift, so neighbouring cities don't sprout tall loops.
const FULL_LIFT_ANGLE = Math.PI / 3
const MIN_LIFT_SHARE = 0.25

/** segments + 1 points along the great circle from a to b, lifted to 1 + lift at the middle. */
export function slerpArc(a: Vec3, b: Vec3, segments: number, lift: number): Vec3[] {
  const dot = Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z))
  const omega = Math.acos(dot)
  const sin = Math.sin(omega)
  const out: Vec3[] = []
  for (let k = 0; k <= segments; k++) {
    const t = k / segments
    const [wa, wb] = sin < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * omega) / sin, Math.sin(t * omega) / sin]
    const r = 1 + lift * Math.sin(Math.PI * t)
    out.push({ x: (a.x * wa + b.x * wb) * r, y: (a.y * wa + b.y * wb) * r, z: (a.z * wa + b.z * wb) * r })
  }
  return out
}

/** One arc per route that joins at least two distinct places; repeated places are skipped. */
export function buildArcs(b: Pick<SavedBriefing, 'keyDevelopments'>, routes: Route[], segments = 48, lift = 0.12): GlobeArc[] {
  const arcs: GlobeArc[] = []
  for (const route of routes) {
    const anchors = route.stops.flatMap((d) => devAnchor(b, d) ?? [])
    const points: Vec3[] = []
    for (let k = 0; k + 1 < anchors.length; k++) {
      const p = anchors[k], q = anchors[k + 1]
      if (p.lat === q.lat && p.lng === q.lng) continue
      const a = toVec3(p.lat, p.lng), c = toVec3(q.lat, q.lng)
      const angle = Math.acos(Math.min(1, Math.max(-1, a.x * c.x + a.y * c.y + a.z * c.z)))
      const share = Math.min(1, Math.max(MIN_LIFT_SHARE, angle / FULL_LIFT_ANGLE))
      const seg = slerpArc(a, c, segments, lift * share)
      points.push(...(points.length ? seg.slice(1) : seg))
    }
    if (points.length) arcs.push({ key: route.key, color: route.color.hex, dashed: route.dashed, points })
  }
  return arcs
}
