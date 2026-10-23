// The loading screen's left column: what Atlas is doing for this briefing, from real
// stream events only. With no stream (an older backend) the rows just say "Working…".
import type { ReactNode } from 'react'
import type { LedgerState, SectionName } from '../lib/ledger'
import './loadingLedger.css'

const COLD_NOTE = 'Waking the backend. Free hosting sleeps when idle, so this can take up to a minute…'
const WORKING = 'Working…'
const SECTIONS: { name: SectionName; label: string }[] = [
  { name: 'developments', label: 'Developments' },
  { name: 'signals', label: 'Signals' },
  { name: 'alerts', label: 'Alerts' },
]

type RowState = 'done' | 'current' | 'waiting'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function sourceValue(entry: { count: number; status: string } | undefined): string {
  if (!entry) return '…'
  if (entry.status === 'ok') return String(entry.count)
  if (entry.status === 'timeout' || entry.status === 'deadline') return 'timed out'
  if (entry.status === 'error') return 'unavailable'
  return 'no results'
}

function Row({ step, state, detail, children }: { step: string; state: RowState; detail?: string; children?: ReactNode }) {
  return (
    <li className="ledger-row" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
      <span className="ledger-step label">{step}</span>
      {detail !== undefined && <span className="ledger-detail">{detail}</span>}
      {children}
    </li>
  )
}

export function LoadingLedger({ ledger, labels, reduced, onCancel }: {
  ledger: LedgerState
  /** Display labels by source name, from /sources; unknown names show as sent. */
  labels: Record<string, string>
  reduced: boolean
  onCancel: () => void
}) {
  const { plan, ranked, sections, streaming } = ledger
  const sourceNames = plan?.sources ?? []
  const sourcesIn = sourceNames.filter((n) => ledger.sources[n]).length
  const allIn = plan !== null && sourcesIn === sourceNames.length
  const written = SECTIONS.every((s) => sections.has(s.name))

  const planState: RowState = plan ? 'done' : 'current'
  const sourcesState: RowState = !plan ? 'waiting' : ranked ? 'done' : 'current'
  const rankState: RowState = ranked ? 'done' : allIn ? 'current' : 'waiting'
  const writeState: RowState = ranked ? 'current' : 'waiting'
  const label = (name: string) => (name === 'rss' ? 'Newsroom feeds' : labels[name] ?? name)

  return (
    <div className={`ledger ${reduced ? '' : 'ledger-enter'}`}>
      <p className="ledger-kicker label">Preparing your briefing</p>
      <h1 className="ledger-focus">{ledger.focus}</h1>
      <ol className="ledger-rows">
        <Row
          step="Plan"
          state={planState}
          detail={plan ? (plan.place ? `${plan.place} · ${plural(plan.queries, 'query', 'queries')}` : plural(plan.queries, 'query', 'queries')) : streaming ? 'Planning the search…' : WORKING}
        />
        <Row
          step="Sources"
          state={sourcesState}
          detail={plan ? `${sourcesIn} of ${plural(sourceNames.length, 'source')} in · ${plural(ledger.articles, 'article')} from ${plural(ledger.outlets.size, 'outlet')}` : streaming ? '' : WORKING}
        >
          {ledger.coldStart && <p className="ledger-cold" role="status">{COLD_NOTE}</p>}
          {plan && (
            <ul className="ledger-sources">
              {sourceNames.map((name) => (
                <li key={name} data-in={String(!!ledger.sources[name])}>
                  <span>{label(name)}</span> <span className="ledger-count">{sourceValue(ledger.sources[name])}</span>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row step="Remove duplicates, rank" state={rankState} detail={ranked ? `${ranked.merged} → ${ranked.kept} kept` : streaming ? '' : WORKING} />
        <Row step="Write" state={writeState} detail={written ? 'Adding context and photos…' : streaming ? undefined : WORKING}>
          {streaming && !written && (
            <ul className="ledger-sections">
              {SECTIONS.map((s) => (
                <li key={s.name} data-section={s.name} data-done={String(sections.has(s.name))}>{s.label}</li>
              ))}
            </ul>
          )}
        </Row>
      </ol>
      <button type="button" className="ledger-cancel" onClick={onCancel}>Cancel</button>
    </div>
  )
}
