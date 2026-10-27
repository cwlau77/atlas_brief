// The loading screen's ledger: a reducer over /briefing/stream's progress events.
// Only real events change it; the one timer-driven action is the cold-start note.
import type { ApiBriefing } from './types'

export type SectionName = 'developments' | 'signals' | 'alerts' | 'outlook'

export type StreamEvent =
  | { type: 'plan'; place: string | null; queries: number; is_finance: boolean; sources: string[] }
  | { type: 'source'; name: string; count: number; status: 'ok' | 'empty' | 'timeout' | 'error' | 'deadline'; outlets: Record<string, number> }
  | { type: 'ranked'; merged: number; deduped: number; kept: number; outlets: number }
  | { type: 'section'; name: SectionName }
  | { type: 'briefing'; briefing: ApiBriefing }
  | { type: 'error'; status: number; detail: string }

export type LedgerAction = StreamEvent | { type: 'cold' } | { type: 'fallback' }

export type LedgerState = {
  focus: string
  coldStart: boolean
  streaming: boolean
  plan: { place: string | null; queries: number; sources: string[] } | null
  sources: Record<string, { count: number; status: string } | undefined>
  articles: number
  outlets: Set<string>
  feedOutlets: Record<string, number>
  ranked: { merged: number; kept: number; outlets: number } | null
  sections: Set<SectionName>
}

export function initialLedger(focus: string): LedgerState {
  return {
    focus, coldStart: false, streaming: true, plan: null, sources: {}, articles: 0,
    outlets: new Set(), feedOutlets: {}, ranked: null, sections: new Set(),
  }
}

function heardFrom(s: LedgerState): boolean {
  return s.plan !== null || Object.keys(s.sources).length > 0 || s.ranked !== null || s.sections.size > 0
}

export function reduceLedger(s: LedgerState, a: LedgerAction): LedgerState {
  switch (a.type) {
    case 'cold':
      return heardFrom(s) ? s : { ...s, coldStart: true }
    case 'fallback':
      return { ...s, streaming: false }
    case 'plan':
      return { ...s, coldStart: false, plan: { place: a.place, queries: a.queries, sources: a.sources } }
    case 'source':
      return {
        ...s,
        coldStart: false,
        sources: { ...s.sources, [a.name]: { count: a.count, status: a.status } },
        articles: s.articles + a.count,
        outlets: new Set([...s.outlets, ...Object.keys(a.outlets)]),
        feedOutlets: a.name === 'rss' ? { ...a.outlets } : s.feedOutlets,
      }
    case 'ranked':
      return { ...s, coldStart: false, ranked: { merged: a.merged, kept: a.kept, outlets: a.outlets } }
    case 'section':
      return { ...s, coldStart: false, sections: new Set([...s.sections, a.name]) }
    default:
      return s
  }
}
