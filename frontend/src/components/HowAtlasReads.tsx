import { STATIC_SERVICE_LABELS, countWord, liveServiceCount, type SourcesInfo } from '../lib/sources'
import './howAtlasReads.css'

const POINTS = [
  { head: 'Breadth', body: 'Aggregators like GDELT and Google News reach tens of thousands of outlets, so regional and local reporting gets in, not just the big wires.' },
  { head: 'Corroboration', body: 'The same event reported by many outlets is merged once and ranked higher.' },
  { head: 'Disagreement', body: 'Where outlets contradict each other, the briefing shows both accounts side by side.' },
] as const

const OUTLETS_NAMED = 8
// The last three static labels are the finance services (see STATIC_SERVICE_LABELS).
const STATIC_FINANCE = 3

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Entry = { label: string; enabled: boolean }

function Entries({ items, states }: { items: Entry[]; states: boolean }) {
  return (
    <ul className="har-list">
      {items.map((s) => (
        <li key={s.label} className={states && !s.enabled ? 'is-off' : undefined}>
          {s.label}
          {states && !s.enabled && <span className="har-off"> off</span>}
        </li>
      ))}
    </ul>
  )
}

/** Home's "How Atlas reads the news": why breadth, corroboration and disagreement matter, and what is read. */
export function HowAtlasReads({ info }: { info: SourcesInfo | null }) {
  const title = info
    ? `${capitalize(countWord(liveServiceCount(info)))} news services, ${countWord(info.feeds.count)} newsroom feeds, one briefing.`
    : 'News services and newsroom feeds, one briefing.'

  const toEntries = (labels: string[]): Entry[] => labels.map((label) => ({ label, enabled: true }))
  const main: Entry[] = info
    ? info.services.filter((s) => !s.financeOnly)
    : toEntries(STATIC_SERVICE_LABELS.slice(0, STATIC_SERVICE_LABELS.length - STATIC_FINANCE))
  const finance: Entry[] = info
    ? info.services.filter((s) => s.financeOnly)
    : toEntries(STATIC_SERVICE_LABELS.slice(-STATIC_FINANCE))
  const outlets = info?.feeds.outlets ?? []

  return (
    <section id="how-atlas-reads" className="har" aria-labelledby="har-title">
      <div className="har-inner wrap">
        <p className="har-kicker label">How Atlas reads the news</p>
        <h2 id="har-title" className="har-title">{title}</h2>
        <div className="har-points">
          {POINTS.map((p) => (
            <div key={p.head} className="har-point">
              <h3>{p.head}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
        <div className="har-sources">
          <Entries items={main} states={info !== null} />
          {finance.length > 0 && (
            <div className="har-finance">
              <p className="har-sub label">Finance questions add</p>
              <Entries items={finance} states={info !== null} />
            </div>
          )}
          {info && outlets.length > 0 && (
            <p className="har-feeds">
              {info.feeds.count} newsroom feeds: {outlets.slice(0, OUTLETS_NAMED).join(', ')}
              {outlets.length > OUTLETS_NAMED ? ', …' : ''}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
