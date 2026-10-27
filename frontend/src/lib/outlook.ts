// The Story tab's Trends & implications rows: Reported first, each naming the
// developments it builds on. Pure.
import type { OutlookBasis, SavedBriefing, ViewOutlook } from './normalize'
import type { SourceCitation } from './types'
import type { TimelineEntry } from './timeline'

export const BASIS_LABELS: Record<OutlookBasis, string> = {
  reported: 'Reported',
  assessment: 'Atlas assessment',
}

export interface OutlookRow {
  /** 'trend-0' | 'implication-1': the item's index in its saved list. */
  key: string
  kind: 'trend' | 'implication'
  basis: OutlookBasis
  statement: string
  quote: string | null
  /** The article a Reported row links to; the first citation. */
  source: SourceCitation | null
  watchFor: string | null
  devs: number[]
  /** The linked developments, in timeline order. */
  linked: { dev: number; title: string; timestamp: string }[]
}

type OutlookInput = Pick<SavedBriefing, 'keyDevelopments' | 'trends' | 'implications'>

function rows(items: ViewOutlook[] | undefined, kind: OutlookRow['kind'], b: OutlookInput, order: TimelineEntry[]): OutlookRow[] {
  return (items ?? [])
    .map((item, i) => {
      const devs = (item.relatedDevelopments ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d < b.keyDevelopments.length)
      return {
        i,
        key: `${kind}-${i}`, kind, basis: item.basis, statement: item.statement, quote: item.quote,
        source: item.sources[0] ?? null, watchFor: item.watchFor, devs,
        linked: order.filter((e) => devs.includes(e.index)).map((e) => ({ dev: e.index, title: e.dev.title, timestamp: e.dev.timestamp })),
      }
    })
    // An assessment must point to the developments it reasons from; the backend drops these too.
    .filter((row) => row.basis === 'reported' || row.linked.length > 0)
    .sort((x, y) => (x.basis === y.basis ? x.i - y.i : x.basis === 'reported' ? -1 : 1))
    .map(({ i: _i, ...row }) => row)
}

export function buildOutlook(b: OutlookInput, order: TimelineEntry[]): { trends: OutlookRow[]; implications: OutlookRow[] } {
  return { trends: rows(b.trends, 'trend', b, order), implications: rows(b.implications, 'implication', b, order) }
}
