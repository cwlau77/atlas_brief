// Pure geometry for the hotspot card, its leader line, the arcs and the sparkline.
// Everything is in pixels in the map's own coordinate space.

export type Pt = [number, number]
export interface Box { x: number; y: number; w: number; h: number }
/** Side of the card the leader enters. */
export type Side = 'l' | 'r' | 't' | 'b'

const LEADER_ELBOW_Y = 56
const VERTICAL_GAP = 36
const ARC_PAD = 16

export function arcControl(from: Pt, to: Pt): Pt {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1])
  return [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - Math.min(130, 0.35 * dist)]
}

export function arcPoints(from: Pt, to: Pt, steps = 20): Pt[] {
  const [cx, cy] = arcControl(from, to)
  const pts: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const a = (1 - s) ** 2
    const b = 2 * (1 - s) * s
    const c = s * s
    pts.push([a * from[0] + b * cx + c * to[0], a * from[1] + b * cy + c * to[1]])
  }
  return pts
}

export function placeCard(args: {
  anchor: Pt
  bounds: Box
  card: { w: number; h: number }
  area: Box
  avoid: Pt[]
  arcs: Pt[]
  gap?: number
}): { box: Box; side: Side } {
  const { anchor, bounds, card, area, avoid, arcs, gap = 64 } = args
  const { w, h } = card
  const midTop = Math.min(Math.max(area.y, anchor[1] - 110), area.y + area.h - h)

  const score = (x: number, y: number): number => {
    if (x < area.x || x + w > area.x + area.w || y < area.y || y + h > area.y + area.h) return Infinity
    const inside = ([px, py]: Pt, pad = 0) => px > x - pad && px < x + w + pad && py > y - pad && py < y + h + pad
    return avoid.filter((p) => inside(p)).length * 10 + arcs.filter((p) => inside(p, ARC_PAD)).length * 6
  }

  const cands = ([
    { x: bounds.x + bounds.w + gap, y: midTop, side: 'l' },
    { x: bounds.x - gap - w, y: midTop, side: 'r' },
    { x: anchor[0] - w / 2, y: bounds.y + bounds.h + VERTICAL_GAP, side: 't' },
    { x: anchor[0] - w / 2, y: bounds.y - VERTICAL_GAP - h, side: 'b' },
  ] as { x: number; y: number; side: Side }[]).map((c) => ({ ...c, s: score(c.x, c.y) }))
  // Array.prototype.sort is stable, so ties keep the right, left, below, above order.
  cands.sort((a, b) => a.s - b.s)

  const best = cands[0]
  if (Number.isFinite(best.s)) return { box: { x: best.x, y: best.y, w, h }, side: best.side }

  const x = Math.max(area.x, Math.min(bounds.x + bounds.w + gap, area.x + area.w - w))
  return { box: { x, y: midTop, w, h }, side: 'l' }
}

export function leaderPath(anchor: Pt, box: Box, side: Side): string {
  const [ax, ay] = anchor
  if (side === 'l' || side === 'r') {
    const ex = side === 'l' ? box.x : box.x + box.w
    const ey = box.y + LEADER_ELBOW_Y
    return `M${ax},${ay} L${(ex + ax) / 2},${ey} L${ex},${ey}`
  }
  const ey = side === 't' ? box.y : box.y + box.h
  const ex = box.x + box.w / 2
  return `M${ax},${ay} L${ex},${(ey + ay) / 2} L${ex},${ey}`
}

export function sparklinePath(values: number[], w: number, h: number): { line: string; area: string; last: Pt } {
  const max = (Math.max(...values, 0) || 1) * 1.1
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * w : w)
  const y = (v: number) => h - 2 - (v / max) * (h - 6)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const last: Pt = values.length ? [x(values.length - 1), y(values[values.length - 1])] : [w, h - 2]
  return { line, area: `${line}L${w},${h}L0,${h}Z`, last }
}
