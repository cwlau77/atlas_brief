// Story-tab logic: chronological order (oldest or newest first) and which tensions/contradictions
// relate to which developments. Links come from the briefing first (related_developments) and
// region names second (a shared region by name); anything unmatched is shown separately,
// never attached at random.
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

/** Display order: newest first, untimed last in original order. */
export function sortNewestFirst(devs: ViewDevelopment[]): TimelineEntry[] {
  return sortDevelopments(devs).sort((a, b) => {
    if (a.time === null || b.time === null) {
      if (a.time === b.time) return a.index - b.index
      return a.time === null ? 1 : -1
    }
    return b.time - a.time || a.index - b.index
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
  const explicit = (indexes: number[]) => {
    const seen = new Set<number>()
    for (const i of indexes) {
      if (Number.isInteger(i) && i >= 0 && i < b.keyDevelopments.length) seen.add(i)
    }
    return [...seen]
  }
  const link = (related: number[] | null | undefined, text: string) =>
    related ? explicit(related) : match(text)
  return {
    tensions: b.emergingTensions.map((t) => link(t.relatedDevelopments, `${t.actors} ${t.description}`)),
    contradictions: b.contradictions.map((c) => link(c.relatedDevelopments, `${c.topic} ${c.account_a} ${c.account_b}`)),
  }
}
