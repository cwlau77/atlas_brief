// Loose-thread strings between developments that share a tension or a source
// disagreement. Pure geometry and pairing; Timeline does the drawing.
import type { BriefingLinks, TimelineEntry } from './timeline'

export interface ThreadSpec {
  key: string
  linkKey: string
  from: number
  to: number
  lane: number
}

/** Chains each item's developments in timeline order; items on a single development get no thread. */
export function buildThreads(links: BriefingLinks, order: TimelineEntry[]): ThreadSpec[] {
  const row = new Map(order.map((e, r) => [e.index, r]))
  const lanes = new Map<string, number>()
  const out: ThreadSpec[] = []
  const add = (kind: 'tension' | 'contradiction', list: number[][]) =>
    list.forEach((devs, i) => {
      const chain = [...devs].sort((a, b) => (row.get(a) ?? 0) - (row.get(b) ?? 0))
      for (let k = 0; k + 1 < chain.length; k++) {
        const [from, to] = [chain[k], chain[k + 1]]
        const pair = `${from}-${to}`
        const lane = lanes.get(pair) ?? 0
        lanes.set(pair, lane + 1)
        const linkKey = `${kind}-${i}`
        out.push({ key: `${linkKey}:${pair}`, linkKey, from, to, lane })
      }
    })
  add('tension', links.tensions)
  add('contradiction', links.contradictions)
  return out
}

const MAX_WOBBLE = 6
const BASE_DEPTH = 56
const LANE_STEP = 14
const MAX_DEPTH = 120 // stays inside the time/node gutter (~160px)

function seeded(seed: string): () => number {
  let h = 0x811c9dc5 // FNV-1a
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    return (((h ^= h >>> 15) >>> 0) / 4294967296) * 2 - 1
  }
}

const n = (v: number) => Number(v.toFixed(1))

/** A soft arc bowing left of x from y1 down to y2, with a small wobble fixed by the seed. */
export function threadPath(x: number, y1: number, y2: number, lane: number, seed: string): string {
  const rand = seeded(seed)
  const depth = Math.min(BASE_DEPTH + lane * LANE_STEP, MAX_DEPTH)
  const span = y2 - y1
  const c1x = x - depth + rand() * MAX_WOBBLE, c1y = y1 + span * 0.12 + rand() * MAX_WOBBLE
  const c2x = x - depth + rand() * MAX_WOBBLE, c2y = y2 - span * 0.12 + rand() * MAX_WOBBLE
  return `M${n(x)} ${n(y1)} C${n(c1x)} ${n(c1y)}, ${n(c2x)} ${n(c2y)}, ${n(x)} ${n(y2)}`
}
