import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MountainBand } from '../components/Footer'
import { PrintIcon, StarIcon, TrashIcon } from '../components/icons'
import { groupThreads, hasHighAlert, type TopicThread } from '../lib/archive'
import type { SavedBriefing } from '../lib/normalize'
import { plural } from '../lib/plural'
import { upperFirst } from '../lib/text'
import { formatDate, formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import './archive.css'

function CompareColumn({ briefing, timeZone }: { briefing: SavedBriefing; timeZone: string }) {
  return (
    <div className="compare-col">
      <h3 className="compare-title">{upperFirst(briefing.area)}</h3>
      <p className="compare-issued label">{formatDateTime(briefing.generatedAt, timeZone)}</p>
      <div className="compare-block">
        <span className="label">Developments</span>
        <ul>{briefing.keyDevelopments.slice(0, 4).map((d, i) => <li key={i}>{d.title}</li>)}</ul>
      </div>
      <div className="compare-block">
        <span className="label">Alerts</span>
        {briefing.alerts.length
          ? <ul>{briefing.alerts.map((a, i) => <li key={i}><strong>{upperFirst(a.label.toLowerCase())}</strong>: {a.title}</li>)}</ul>
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

const dayMonth = (iso: string, tz: string) => formatDate(iso, tz).replace(/ \d{4}$/, '')

export function ArchivePage() {
  const { saved, starred, toggleStar, setStars, removeBriefing, removeBriefings, pushToast, settings } = useAppState()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') === 'starred' ? 'starred' : 'all'
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<SavedBriefing | null>(null)
  // Select mode: a checkbox per briefing, with bulk star and delete.
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [pendingBulk, setPendingBulk] = useState<string[] | null>(null)
  const tz = settings.timeZone

  const threads = useMemo<TopicThread[]>(() => {
    const visible = filter === 'starred' ? saved.filter((b) => starred.includes(b.id)) : saved
    return groupThreads(visible)
  }, [saved, starred, filter])
  // Only what is on screen counts: a filter change or an unstar under the Starred filter hides briefings.
  const visibleIds = useMemo(() => new Set(threads.flatMap((t) => t.briefings.map((b) => b.id))), [threads])
  const selection = picked.filter((id) => visibleIds.has(id))
  const allStarred = selection.length > 0 && selection.every((id) => starred.includes(id))
  const togglePick = (ids: string[], on: boolean) =>
    setPicked((prev) => (on ? [...prev, ...ids.filter((id) => !prev.includes(id))] : prev.filter((id) => !ids.includes(id))))
  const pair = useMemo(
    () => selected.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBriefing => !!b),
    [selected, saved],
  )
  const setFilter = (next: 'all' | 'starred') => setParams(next === 'starred' ? { filter: 'starred' } : {}, { replace: true })
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev.slice(-1), id]))
  const confirmDelete = () => {
    if (pendingBulk) {
      removeBriefings(pendingBulk)
      setPicked([])
      setPendingBulk(null)
      pushToast(`${plural(pendingBulk.length, 'briefing')} removed`, 'info', 2000)
      return
    }
    if (!pendingDelete) return
    removeBriefing(pendingDelete.id)
    setSelected((prev) => prev.filter((s) => s !== pendingDelete.id))
    setPendingDelete(null)
    pushToast('Briefing removed', 'info', 2000)
  }
  const bulkStarred = pendingBulk ? pendingBulk.filter((id) => starred.includes(id)).length : 0

  const beadLabel = (b: SavedBriefing) =>
    `${b.area}, ${dayMonth(b.generatedAt, tz)}, ${plural(b.stats.articles, 'article')}${hasHighAlert(b) ? ', high alert' : ''}`
  const beadSize = (b: SavedBriefing) => 10 + 2 * Math.min(5, Math.round(b.stats.articles / 5))
  // A render function, not a nested component, so React keeps the buttons (and their focus) across renders.
  const beadActions = (b: SavedBriefing) => {
    const isStarred = starred.includes(b.id)
    return (
      <div className="bead-actions">
        <button type="button" className={`star-btn ${isStarred ? 'on' : ''}`} onClick={() => toggleStar(b.id)} aria-label={isStarred ? `Unstar ${beadLabel(b)}` : `Star ${beadLabel(b)}`} aria-pressed={isStarred}>
          <StarIcon size={15} filled={isStarred} />
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => navigate(`/brief/${b.id}?print=1`)} aria-label={`Print ${beadLabel(b)}`}><PrintIcon size={14} /></button>
        <button type="button" className="btn btn-quiet" onClick={() => setPendingDelete(b)} aria-label={`Delete ${beadLabel(b)}`}><TrashIcon size={14} /></button>
      </div>
    )
  }

  return (
    <div className="page wrap archive">
      <header className="page-head page-head-row">
        <h1 className="page-title">Your threads</h1>
        <p className="page-meta label">{plural(threads.length, 'thread')} · Up to 4 briefings per topic and 24 in total are kept in this browser.</p>
      </header>

      {saved.length === 0 ? (
        <div className="saved-empty">
          <MountainBand height="empty" />
          <h2>No threads yet</h2>
          <p>Generate a briefing and it is saved here automatically. Briefings on the same topic string together into a thread.</p>
          <Link className="btn btn-primary" to="/" state={{ focusAsk: true }}>Start a brief</Link>
        </div>
      ) : (
        <>
          <div className="saved-toolbar">
            <div className="saved-filters" role="group" aria-label="Filter briefings">
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'all' ? 'on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'starred' ? 'on' : ''}`} aria-pressed={filter === 'starred'} onClick={() => setFilter('starred')}>Starred</button>
            </div>
            <div className="saved-filters">
              <button
                type="button"
                className={`btn btn-quiet saved-filter ${selecting ? 'on' : ''}`}
                aria-pressed={selecting}
                onClick={() => {
                  setSelecting((on) => !on)
                  setPicked([])
                  setComparing(false)
                  setSelected([])
                }}
              >
                Select
              </button>
              <button
                type="button"
                className={`btn btn-quiet saved-filter ${comparing ? 'on' : ''}`}
                aria-pressed={comparing}
                onClick={() => {
                  setComparing((c) => !c)
                  setSelected([])
                  setSelecting(false)
                  setPicked([])
                }}
              >
                Compare two
              </button>
            </div>
          </div>
          {comparing && <p className="compare-hint label">Pick two beads to compare them side by side.</p>}

          {threads.length === 0 ? (
            <p className="story-note">No starred briefings yet.</p>
          ) : (
            <div className="threads-list">
              {threads.map((t) => {
                const latest = t.briefings[t.briefings.length - 1]
                const anyStar = t.briefings.some((b) => starred.includes(b.id))
                const ids = t.briefings.map((b) => b.id)
                const pickedHere = ids.filter((id) => selection.includes(id)).length
                return (
                  <article key={t.key} className="thread-row">
                    <div className="thread-name">
                      {selecting && (
                        <input
                          type="checkbox"
                          className="thread-check"
                          aria-label={`Select all in ${t.area}`}
                          checked={pickedHere === ids.length}
                          ref={(el) => { if (el) el.indeterminate = pickedHere > 0 && pickedHere < ids.length }}
                          onChange={() => togglePick(ids, pickedHere < ids.length)}
                        />
                      )}
                      <h2 className="thread-title">{upperFirst(t.area)}{anyStar && <StarIcon size={14} filled className="thread-star" />}</h2>
                      <p className="label">{plural(t.briefings.length, 'briefing')} · since {dayMonth(t.briefings[0].generatedAt, tz)}</p>
                    </div>
                    <ol className="thread-string">
                      {t.briefings.map((b) => {
                        const style = { '--bead': `${beadSize(b)}px` } as CSSProperties
                        const cls = `bead ${hasHighAlert(b) ? 'bead-alert' : ''} ${b === latest ? 'latest' : ''}`
                        return (
                          <li key={b.id} className="bead-slot">
                            {selecting ? (
                              <label className={`${cls} bead-check ${selection.includes(b.id) ? 'picked' : ''}`} style={style}>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${beadLabel(b)}`}
                                  checked={selection.includes(b.id)}
                                  onChange={(e) => togglePick([b.id], e.target.checked)}
                                />
                              </label>
                            ) : comparing ? (
                              <button
                                type="button"
                                className={`${cls} ${selected.includes(b.id) ? 'picked' : ''}`}
                                style={style}
                                aria-pressed={selected.includes(b.id)}
                                aria-label={`Compare ${beadLabel(b)}`}
                                onClick={() => toggleSelect(b.id)}
                              />
                            ) : (
                              <Link className={cls} style={style} to={`/brief/${b.id}`} aria-label={beadLabel(b)} />
                            )}
                            <span className="bead-date label" aria-hidden="true">{dayMonth(b.generatedAt, tz)}</span>
                            {!comparing && !selecting && (
                              <div className="bead-pop">
                                <p className="label">{formatDateTime(b.generatedAt, tz)}</p>
                                {beadActions(b)}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                    <p className="thread-count label">{plural(latest.stats.articles, 'article')}</p>
                    {/* Touch screens can't hover a bead, so the same actions live in a list here (CSS shows it only without hover). */}
                    <details className="thread-manage">
                      <summary className="label">Manage briefings</summary>
                      <ul>
                        {t.briefings.map((b) => (
                          <li key={b.id}>
                            <Link to={`/brief/${b.id}`}>{formatDateTime(b.generatedAt, tz)}</Link>
                            {beadActions(b)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                )
              })}
            </div>
          )}

          {selecting && selection.length > 0 && (
            <div className="select-bar" role="region" aria-label="Selected briefings">
              <span className="label">{selection.length} selected</span>
              <button type="button" className="btn btn-quiet" onClick={() => setStars(selection, !allStarred)}>
                <StarIcon size={14} filled={!allStarred} />{allStarred ? `Unstar ${selection.length}` : `Star ${selection.length}`}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setPendingBulk(selection)}>
                <TrashIcon size={14} />Delete {selection.length}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setPicked([])}>Clear</button>
            </div>
          )}

          {pair.length === 2 && (
            <section className="compare-panel" aria-labelledby="compare-h">
              <h2 id="compare-h" className="label label-mark">Side by side</h2>
              <div className="compare-split">
                <CompareColumn briefing={pair[0]} timeZone={tz} />
                <CompareColumn briefing={pair[1]} timeZone={tz} />
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null || pendingBulk !== null}
        title={pendingBulk ? `Remove ${plural(pendingBulk.length, 'briefing')}?` : 'Remove this briefing?'}
        body={pendingBulk
          ? `${plural(pendingBulk.length, 'briefing')} will be removed from this browser.${
            bulkStarred ? ` ${bulkStarred} of them ${bulkStarred === 1 ? 'is' : 'are'} starred.` : ''}`
          : pendingDelete ? `${beadLabel(pendingDelete)} will be removed from this browser.` : ''}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => { setPendingDelete(null); setPendingBulk(null) }}
      />
    </div>
  )
}
