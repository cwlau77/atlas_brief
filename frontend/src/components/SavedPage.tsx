import { useMemo, useState } from 'react'
import type { SavedBriefing } from '../lib/normalize'
import { formatDate, relativeTime } from '../lib/relativeTime'
import { useSpotlight } from '../lib/useSpotlight'
import { PrintIcon, StarIcon, TrashIcon } from './icons'
import './saved.css'

function CompareColumn({ briefing }: { briefing: SavedBriefing }) {
  return (
    <div className="compare-col">
      <h3 className="compare-title">{briefing.area}</h3>
      <p className="compare-issued mono">{formatDate(briefing.generatedAt)}</p>
      <div className="compare-block">
        <span className="signal-label">Developments</span>
        <ul>
          {briefing.keyDevelopments.slice(0, 4).map((d, i) => <li key={i}>{d.title}</li>)}
        </ul>
      </div>
      <div className="compare-block">
        <span className="signal-label">Alerts</span>
        {briefing.alerts.length
          ? <ul>{briefing.alerts.map((a, i) => <li key={i}><strong>{a.label}</strong> — {a.title}</li>)}</ul>
          : <p className="compare-none">None issued.</p>}
      </div>
      <div className="compare-block">
        <span className="signal-label">Tensions</span>
        {briefing.emergingTensions.length
          ? <ul>{briefing.emergingTensions.map((t, i) => <li key={i}>{t.actors}</li>)}</ul>
          : <p className="compare-none">None surfaced.</p>}
      </div>
    </div>
  )
}

export function SavedPage({ saved, starredIds, onView, onToggleStar, onDelete, onPrint }: {
  saved: SavedBriefing[]
  starredIds: string[]
  onView: (b: SavedBriefing) => void
  onToggleStar: (id: string) => void
  onDelete: (id: string) => void
  onPrint: (b: SavedBriefing) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'starred'>('all')

  const visible = useMemo(
    () => (filter === 'starred' ? saved.filter((b) => starredIds.includes(b.id)) : saved),
    [saved, starredIds, filter],
  )

  const pair = useMemo(
    () => selected.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBriefing => !!b),
    [selected, saved],
  )

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev.slice(-1), id], // keep max 2
    )
  }

  const spot = useSpotlight()

  if (!saved.length) {
    return (
      <div className="saved-empty panel">
        <h3>The archive is empty</h3>
        <p>Generate a briefing and it will be filed here automatically — the newest twelve are kept.</p>
      </div>
    )
  }

  return (
    <div className="saved-page">
      <div className="saved-toolbar">
        <div className="signal-label">Filed briefings · {visible.length}</div>
        <div className="saved-filters">
          <button
            className={`btn btn-quiet saved-filter ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
          >All</button>
          <button
            className={`btn btn-quiet saved-filter ${filter === 'starred' ? 'on' : ''}`}
            onClick={() => setFilter('starred')}
          >Starred</button>
        </div>
      </div>

      <div className="saved-grid">
        {visible.map((b) => {
          const starred = starredIds.includes(b.id)
          const checked = selected.includes(b.id)
          return (
            <article key={b.id} className={`panel spot saved-card ${checked ? 'selected' : ''}`} onMouseMove={spot}>
              <header className="saved-card-head">
                <div>
                  <h3 className="saved-card-title">{b.area}</h3>
                  <span className="saved-card-date mono">filed {relativeTime(b.generatedAt)}</span>
                </div>
                <button
                  className={`star-btn ${starred ? 'on' : ''}`}
                  onClick={() => onToggleStar(b.id)}
                  aria-label={starred ? 'Unstar briefing' : 'Star briefing'}
                  aria-pressed={starred}
                >
                  <StarIcon size={17} filled={starred} />
                </button>
              </header>
              <p className="saved-card-lede">
                {b.keyDevelopments[0]?.title ?? 'Saved briefing ready to review.'}
              </p>
              <div className="saved-card-stats mono">
                {b.stats.articles} articles · {b.stats.regions} regions · {b.stats.alerts} alerts
              </div>
              <footer className="saved-card-actions">
                <button className="btn btn-primary saved-view" onClick={() => onView(b)}>Open</button>
                <button className="btn btn-quiet" onClick={() => onPrint(b)} aria-label="Print or export briefing">
                  <PrintIcon size={14} /> Print
                </button>
                <button className="btn btn-quiet" onClick={() => onDelete(b.id)} aria-label="Delete briefing">
                  <TrashIcon size={14} />
                </button>
                <label className="compare-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelect(b.id)}
                    aria-label={`Select ${b.area} for comparison`}
                  />
                  compare
                </label>
              </footer>
            </article>
          )
        })}
      </div>

      {pair.length === 2 && (
        <section className="compare-panel panel" aria-label="Briefing comparison">
          <div className="signal-label">Side by side</div>
          <div className="compare-split">
            <CompareColumn briefing={pair[0]} />
            <CompareColumn briefing={pair[1]} />
          </div>
        </section>
      )}
    </div>
  )
}
