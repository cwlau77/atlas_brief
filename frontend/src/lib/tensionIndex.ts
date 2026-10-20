// The briefing page's tension index: every tension and contradiction as one
// list, busiest first, with the route colour of those that hold a lane. Pure.
import type { SavedBriefing } from './normalize'
import { buildRoutes, type RouteColor } from './routes'
import { linkBriefing, type TimelineEntry } from './timeline'

export interface IndexItem {
  /** 'tension-0' | 'contradiction-2', the same keys as LinkRef. */
  key: string
  kind: 'tension' | 'contradiction'
  /** Tension: actors. Contradiction: topic. */
  sides: string
  /** Tension: description. Contradiction: both accounts joined. */
  why: string
  /** Linked development indexes. */
  devs: number[]
  /** Route colour when the item holds a lane, else null. */
  color: RouteColor | null
}

type IndexInput = Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>

export function buildTensionIndex(b: IndexInput, order: TimelineEntry[]): IndexItem[] {
  const links = linkBriefing(b)
  const { colorFor } = buildRoutes(b, order)
  const items: (IndexItem & { i: number })[] = [
    ...b.emergingTensions.map((t, i) => ({
      key: `tension-${i}`, kind: 'tension' as const, i,
      sides: t.actors, why: t.description, devs: links.tensions[i] ?? [],
    })),
    ...b.contradictions.map((c, i) => ({
      key: `contradiction-${i}`, kind: 'contradiction' as const, i,
      sides: c.topic, why: `${c.account_a} / ${c.account_b}`, devs: links.contradictions[i] ?? [],
    })),
  ].map((item) => ({ ...item, color: colorFor.get(item.key) ?? null }))
  items.sort((x, y) =>
    y.devs.length - x.devs.length || (x.kind === y.kind ? 0 : x.kind === 'tension' ? -1 : 1) || x.i - y.i)
  return items.map(({ i: _i, ...item }) => item)
}

/** "2 tensions", "1 tension · 1 contradiction", or null when nothing links to the development. */
export function connectionLabel(items: IndexItem[], devIndex: number): string | null {
  const linked = items.filter((item) => item.devs.includes(devIndex))
  const count = (kind: IndexItem['kind']) => linked.filter((item) => item.kind === kind).length
  const parts = ([['tension', count('tension')], ['contradiction', count('contradiction')]] as const)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${n} ${kind}${n === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' · ') : null
}
