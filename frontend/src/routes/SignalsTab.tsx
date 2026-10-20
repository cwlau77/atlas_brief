import { SOURCE_LABELS, shares, summarizeSignals, topEntries } from '../lib/signals'
import { plural } from '../lib/plural'
import { useBriefing } from './briefingContext'
import './signals.css'

// The route lane palette doubles as the source mix palette: five distinct, non-heat colours.
const SEGMENT_COLORS = ['var(--route-1)', 'var(--route-2)', 'var(--route-3)', 'var(--route-4)', 'var(--route-5)']

function RankRows({ rows, emptyText }: { rows: [string, number][]; emptyText: string }) {
  if (!rows.length) return <p className="viz-empty">{emptyText}</p>
  const max = rows[0][1]
  return (
    <ol className="rows">
      {rows.map(([name, value]) => (
        <li key={name} className="row">
          <span className="row-name">{name}</span>
          <span className="bar" aria-hidden="true"><i style={{ width: `${((value / max) * 100).toFixed(1)}%` }} /></span>
          <span className="row-n mono">{value}</span>
        </li>
      ))}
    </ol>
  )
}

export function SignalsTab() {
  const b = useBriefing()
  const sources = shares(b.sourceBreakdown, SOURCE_LABELS)
  const sourceTotal = sources.reduce((t, x) => t + x.count, 0)
  const stats: [string, number][] = [
    ['Articles', b.stats.articles],
    ['Sources', b.stats.sources],
    ['Regions', b.stats.regions],
    ['Alerts', b.stats.alerts],
  ]

  return (
    <div className="signals wrap">
      <p className="insight">{summarizeSignals(b)}</p>

      <dl className="stat-strip">
        {stats.map(([k, v]) => (
          <div className="stat" key={k}>
            <dt className="label">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="viz">
        <section aria-labelledby="mix-h">
          <h2 id="mix-h" className="viz-title">Source mix <span className="label">{plural(sourceTotal, 'article')}</span></h2>
          {sources.length ? (
            <>
              <div className="stack" role="img" aria-label={sources.map((s) => `${s.label} ${s.pct} percent`).join(', ')}>
                {sources.map((s, i) => (
                  <span key={s.key} style={{ width: `${s.pct}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                ))}
              </div>
              <div className="stack-legend">
                {sources.map((s, i) => (
                  <div key={s.key}>
                    <span className="sw"><i style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />{s.label}</span>
                    <span className="pct">{s.pct}%</span>
                    <span className="n label">{plural(s.count, 'article')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="viz-empty">No source breakdown came back with this briefing.</p>
          )}
        </section>

        <section aria-labelledby="regions-h">
          <h2 id="regions-h" className="viz-title">Most-mentioned regions <span className="label">Mentions</span></h2>
          <RankRows rows={topEntries(b.regionCounts, 8)} emptyText="No regions were tagged in this briefing." />
        </section>

        <section aria-labelledby="outlets-h">
          <h2 id="outlets-h" className="viz-title">Most-cited outlets <span className="label">Citations</span></h2>
          <RankRows rows={topEntries(b.outletCounts, 8)} emptyText="No outlet citations in this briefing." />
        </section>
      </div>
    </div>
  )
}
