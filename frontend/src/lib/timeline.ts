// Story-tab logic: chronological order and which tensions/contradictions
// relate to which developments. Links require a shared region by name;
// anything unmatched is shown separately, never attached at random.
import type { SavedBriefing, ViewDevelopment } from './normalize'

export interface TimelineEntry {
  index: number
  dev: ViewDevelopment
  time: number | null
}

export function sortDevelopments(devs: ViewDevelopment[]): TimelineEntry[] {
  return devs
    .map((dev, index) => {
      const t = Date.parse(dev.timestamp)
      return { index, dev, time: Number.isNaN(t) ? null : t }
    })
    .sort((a, b) => {
      if (a.time === null || b.time === null) {
        if (a.time === b.time) return a.index - b.index
        return a.time === null ? 1 : -1
      }
      return a.time - b.time || a.index - b.index
    })
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mentionsRegion(text: string, region: string): boolean {
  const name = region.trim()
  if (!name || !text) return false
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}(?=$|[^\\p{L}\\p{N}])`, 'iu')
  return pattern.test(text)
}

export interface BriefingLinks {
  tensions: number[][]
  contradictions: number[][]
}

export function linkBriefing(
  b: Pick<SavedBriefing, 'keyDevelopments' | 'emergingTensions' | 'contradictions'>,
): BriefingLinks {
  const match = (text: string) =>
    b.keyDevelopments.flatMap((d, i) => (d.regions.some((r) => mentionsRegion(text, r)) ? [i] : []))
  return {
    tensions: b.emergingTensions.map((t) => match(`${t.actors} ${t.description}`)),
    contradictions: b.contradictions.map((c) => match(`${c.topic} ${c.account_a} ${c.account_b}`)),
  }
}

export interface LinkRef {
  kind: 'tension' | 'contradiction'
  i: number
  key: string
}

/** Development index → the tensions, then contradictions, linked to it. */
export function linksByDevelopment(links: BriefingLinks): Map<number, LinkRef[]> {
  const map = new Map<number, LinkRef[]>()
  const add = (kind: LinkRef['kind'], list: number[][]) =>
    list.forEach((devs, i) => {
      for (const d of devs) map.set(d, [...(map.get(d) ?? []), { kind, i, key: `${kind}-${i}` }])
    })
  add('tension', links.tensions)
  add('contradiction', links.contradictions)
  return map
}
