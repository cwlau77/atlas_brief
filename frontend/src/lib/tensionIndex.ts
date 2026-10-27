// The briefing page's tension index: every tension and contradiction as one
// list, busiest first, with the route colour of those that hold a lane. Pure.
import { actorsText, type SavedBriefing, type TensionRelationship } from './normalize'
import { buildRoutes, type RouteColor } from './routes'
import { linkBriefing, type TimelineEntry } from './timeline'

export interface IndexItem {
  /** 'tension-0' | 'contradiction-2', the same keys as the route colours. */
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
  /** How the sides relate, in words; null for a tension synthesis gave no relationship. */
  relation: string | null
  /** The linked developments, in timeline order: what the row's "Ties to" list names. */
  linked: { dev: number; title: string; timestamp: string }[]
}

export const RELATIONSHIP_LABELS: Record<TensionRelationship, string> = {
  in_conflict: 'In open conflict',
  rivalry: 'Rivals, no clash yet',
  competing_claims: 'Competing claims',
  pressure: 'Pressure and pushback',
  negotiating: 'Negotiating',
  uneasy_partners: 'Uneasy partners',
}

export const CONTRADICTION_RELATION = 'Same event, different accounts'

type IndexInput = Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>

export function buildTensionIndex(b: IndexInput, order: TimelineEntry[]): IndexItem[] {
  const links = linkBriefing(b)
  const { colorFor } = buildRoutes(b, order)
  const items: (IndexItem & { i: number })[] = [
    ...b.emergingTensions.map((t, i) => ({
      key: `tension-${i}`, kind: 'tension' as const, i,
      sides: actorsText(t.actors), why: t.description, devs: links.tensions[i] ?? [],
      relation: t.relationship ? RELATIONSHIP_LABELS[t.relationship] : null,
    })),
    ...b.contradictions.map((c, i) => ({
      key: `contradiction-${i}`, kind: 'contradiction' as const, i,
      sides: c.topic, why: `${c.account_a} / ${c.account_b}`, devs: links.contradictions[i] ?? [],
      relation: CONTRADICTION_RELATION,
    })),
  ].map((item) => ({
    ...item,
    color: colorFor.get(item.key) ?? null,
    linked: order
      .filter((e) => item.devs.includes(e.index))
      .map((e) => ({ dev: e.index, title: e.dev.title, timestamp: e.dev.timestamp })),
  }))
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
