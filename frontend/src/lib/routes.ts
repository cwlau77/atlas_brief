// Transit-style routes: a tension or source disagreement linked to two or more
// developments, drawn as its own lane beside the timeline and as a globe arc.
// Pure; Timeline and the globe do the drawing.
import type { SavedBriefing } from './normalize'
import { linkBriefing, type TimelineEntry } from './timeline'

export interface RouteColor { token: string; hex: string }

export interface Route {
  key: string
  kind: 'tension' | 'contradiction'
  i: number
  title: string
  /** Development indexes, in timeline order. */
  stops: number[]
  lane: number
  color: RouteColor
  dashed: boolean
}

/** Brand colours in assignment order; hex is what the globe draws with. */
export const ROUTE_COLORS: RouteColor[] = [
  { token: '--ochre', hex: '#9C7026' },
  { token: '--ink', hex: '#1C231F' },
  { token: '--celadon', hex: '#5E8A79' },
  { token: '--sand', hex: '#C7B89C' },
  { token: '--celadon-deep', hex: '#3A5F52' },
]
export const MAX_LANES = ROUTE_COLORS.length

const DASH = 5
const GAP = 4

/**
 * Lane holders (busiest first; tension before contradiction on ties, then by
 * index) and their colours by link key. Busier items past MAX_LANES stay tabs only.
 */
export function buildRoutes(
  b: Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>,
  order: TimelineEntry[],
): { routes: Route[]; colorFor: Map<string, RouteColor> } {
  const links = linkBriefing(b)
  const row = new Map(order.map((e, r) => [e.index, r]))
  const inOrder = (devs: number[]) => [...devs].sort((x, y) => (row.get(x) ?? 0) - (row.get(y) ?? 0))
  const candidates = [
    ...links.tensions.map((devs, i) => ({ kind: 'tension' as const, i, devs, title: b.emergingTensions[i]?.actors ?? '' })),
    ...links.contradictions.map((devs, i) => ({ kind: 'contradiction' as const, i, devs, title: b.contradictions[i]?.topic ?? '' })),
  ].filter((c) => c.devs.length >= 2)
  candidates.sort((x, y) =>
    y.devs.length - x.devs.length || (x.kind === y.kind ? 0 : x.kind === 'tension' ? -1 : 1) || x.i - y.i)
  const routes = candidates.slice(0, MAX_LANES).map((c, lane): Route => ({
    key: `${c.kind}-${c.i}`,
    kind: c.kind,
    i: c.i,
    title: c.title,
    stops: inOrder(c.devs),
    lane,
    color: ROUTE_COLORS[lane],
    dashed: c.kind === 'contradiction',
  }))
  return { routes, colorFor: new Map(routes.map((r) => [r.key, r.color])) }
}

/**
 * A stroke-dasharray that draws a segment of this length (solid or dashed),
 * followed by one gap as long as the segment, so a dash offset of `len` hides
 * it and easing the offset to 0 draws it downward.
 */
export function routeDashArray(len: number, dashed: boolean): string {
  const n = Math.round(len)
  if (!dashed) return `${n} ${n}`
  const pairs = Math.max(1, Math.ceil(n / (DASH + GAP)))
  return `${Array.from({ length: pairs }, () => `${DASH} ${GAP}`).join(' ')} ${n}`
}
