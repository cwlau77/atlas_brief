import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PrintIcon, StarIcon, TrashIcon } from '../components/icons'
import type { SavedBriefing } from '../lib/normalize'
import { relativeTime } from '../lib/relativeTime'
import { formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import './archive.css'

function CompareColumn({ briefing, timeZone }: { briefing: SavedBriefing; timeZone: string }) {
  return (
    <div className="compare-col">
      <h3 className="compare-title">{briefing.area}</h3>
      <p className="compare-issued label">{formatDateTime(briefing.generatedAt, timeZone)}</p>
      <div className="compare-block">
        <span className="label">Developments</span>
        <ul>{briefing.keyDevelopments.slice(0, 4).map((d, i) => <li key={i}>{d.title}</li>)}</ul>
      </div>
      <div className="compare-block">
        <span className="label">Alerts</span>
        {briefing.alerts.length
          ? <ul>{briefing.alerts.map((a, i) => <li key={i}><strong>{a.label}</strong>: {a.title}</li>)}</ul>
          : <p className="compare-none">None issued.</p>}
      </div>
      <div className="compare-block">
        <span className="label">Tensions</span>
        {briefing.emergingTensions.length
          ? <ul>{briefing.emergingTensions.map((t, i) => <li key={i}>{t.actors}</li>)}</ul>
          : <p className="compare-none">None surfaced.</p>}
      </div>
    </div>
  )
}

export function ArchivePage() {
  const { saved, starred, toggleStar, removeBriefing, pushToast, settings } = useAppState()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'starred'>('all')

  const visible = useMemo(
    () => (filter === 'starred' ? saved.filter((b) => starred.includes(b.id)) : saved),
    [saved, starred, filter],
  )
  const pair = useMemo(
    () => selected.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBriefing => !!b),
    [selected, saved],
  )
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev.slice(-1), id]))
  const onDelete = (id: string) => {
    if (!window.confirm('Remove this briefing from the archive?')) return
    removeBriefing(id)
    setSelected((prev) => prev.filter((s) => s !== id))
    pushToast('Briefing removed', 'info', 2000)
  }

  return (
    <div className="page wrap archive">
      <header className="page-head">
        <p className="page-kicker label">Archive</p>
        <h1 className="page-title">Saved briefings</h1>
        <p className="page-lede">The newest twelve briefings are kept in this browser.</p>
      </header>

      {saved.length === 0 ? (
        <div className="saved-empty">
          <img className="brand-object" src="/brand/atlas-mark.svg" alt="" width="96" height="96" />
          <h2>The archive is empty</h2>
          <p>Generate a briefing and it is saved here automatically.</p>
          <Link className="btn btn-primary" to="/" data-cursor="link">Start a brief</Link>
        </div>
      ) : (
        <>
          <div className="saved-toolbar">
            <p className="label">{visible.length} filed</p>
            <div className="saved-filters" role="group" aria-label="Filter briefings">
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'all' ? 'on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-cursor="link">All</button>
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'starred' ? 'on' : ''}`} aria-pressed={filter === 'starred'} onClick={() => setFilter('starred')} data-cursor="link">Starred</button>
            </div>
          </div>

          <div className="saved-grid">
            {visible.map((b) => {
              const isStarred = starred.includes(b.id)
              const checked = selected.includes(b.id)
              return (
                <article key={b.id} className={`saved-card ${checked ? 'selected' : ''}`}>
                  <header className="saved-card-head">
                    <div>
                      <h2 className="saved-card-title">{b.area}</h2>
                      <span className="saved-card-date label">Filed {relativeTime(b.generatedAt)}</span>
                    </div>
                    <button
                      type="button"
                      className={`star-btn ${isStarred ? 'on' : ''}`}
                      onClick={() => toggleStar(b.id)}
                      aria-label={isStarred ? 'Unstar briefing' : 'Star briefing'}
                      aria-pressed={isStarred}
                      data-cursor="link"
                    >
                      <StarIcon size={17} filled={isStarred} />
                    </button>
                  </header>
                  <p className="saved-card-lede">{b.keyDevelopments[0]?.title ?? 'Saved briefing ready to review.'}</p>
                  <p className="saved-card-stats label">{b.stats.articles} articles · {b.stats.regions} regions · {b.stats.alerts} alerts</p>
                  <footer className="saved-card-actions">
                    <button type="button" className="btn btn-primary saved-view" onClick={() => navigate(`/brief/${b.id}`)} data-cursor="link">Open</button>
                    <button type="button" className="btn btn-quiet" onClick={() => navigate(`/brief/${b.id}?print=1`)} aria-label={`Print ${b.area}`} data-cursor="link">
                      <PrintIcon size={14} /> Print
                    </button>
                    <button type="button" className="btn btn-quiet" onClick={() => onDelete(b.id)} aria-label={`Delete ${b.area}`} data-cursor="link">
                      <TrashIcon size={14} />
                    </button>
                    <label className="compare-check">
                      <input type="checkbox" checked={checked} onChange={() => toggleSelect(b.id)} aria-label={`Select ${b.area} for comparison`} />
                      Compare
                    </label>
                  </footer>
                </article>
              )
            })}
          </div>

          {pair.length === 2 && (
            <section className="compare-panel" aria-labelledby="compare-h">
              <h2 id="compare-h" className="label">Side by side</h2>
              <div className="compare-split">
                <CompareColumn briefing={pair[0]} timeZone={settings.timeZone} />
                <CompareColumn briefing={pair[1]} timeZone={settings.timeZone} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
