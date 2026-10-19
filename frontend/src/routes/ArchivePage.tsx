import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { MountainBand } from '../components/Footer'
import { PrintIcon, StarIcon, TrashIcon } from '../components/icons'
import { groupThreads, hasHighAlert, type TopicThread } from '../lib/archive'
import type { SavedBriefing } from '../lib/normalize'
import { plural } from '../lib/plural'
import { formatDate, formatDateTime } from '../lib/time'
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

const dayMonth = (iso: string, tz: string) => formatDate(iso, tz).replace(/ \d{4}$/, '')

export function ArchivePage() {
  const { saved, starred, toggleStar, removeBriefing, pushToast, settings } = useAppState()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') === 'starred' ? 'starred' : 'all'
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<SavedBriefing | null>(null)
  const tz = settings.timeZone

  const threads = useMemo<TopicThread[]>(() => {
    const visible = filter === 'starred' ? saved.filter((b) => starred.includes(b.id)) : saved
    return groupThreads(visible)
  }, [saved, starred, filter])
  const pair = useMemo(
    () => selected.map((id) => saved.find((b) => b.id === id)).filter((b): b is SavedBriefing => !!b),
    [selected, saved],
  )
  const setFilter = (next: 'all' | 'starred') => setParams(next === 'starred' ? { filter: 'starred' } : {}, { replace: true })
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev.slice(-1), id]))
  const confirmDelete = () => {
    if (!pendingDelete) return
    removeBriefing(pendingDelete.id)
    setSelected((prev) => prev.filter((s) => s !== pendingDelete.id))
    setPendingDelete(null)
    pushToast('Briefing removed', 'info', 2000)
  }

  const beadLabel = (b: SavedBriefing) =>
    `${b.area}, ${dayMonth(b.generatedAt, tz)}, ${plural(b.stats.articles, 'article')}${hasHighAlert(b) ? ', high alert' : ''}`
  const beadSize = (b: SavedBriefing) => 10 + 2 * Math.min(5, Math.round(b.stats.articles / 5))

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
          <Link className="btn btn-primary" to="/" state={{ focusAsk: true }} data-cursor="link">Start a brief</Link>
        </div>
      ) : (
        <>
          <div className="saved-toolbar">
            <div className="saved-filters" role="group" aria-label="Filter briefings">
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'all' ? 'on' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-cursor="link">All</button>
              <button type="button" className={`btn btn-quiet saved-filter ${filter === 'starred' ? 'on' : ''}`} aria-pressed={filter === 'starred'} onClick={() => setFilter('starred')} data-cursor="link">Starred</button>
            </div>
            <button
              type="button"
              className={`btn btn-quiet saved-filter ${comparing ? 'on' : ''}`}
              aria-pressed={comparing}
              onClick={() => {
                setComparing((c) => !c)
                setSelected([])
              }}
              data-cursor="link"
            >
              Compare two
            </button>
          </div>
          {comparing && <p className="compare-hint label">Pick two beads to compare them side by side.</p>}

          {threads.length === 0 ? (
            <p className="story-note">No starred briefings yet.</p>
          ) : (
            <div className="threads-list">
              {threads.map((t) => {
                const latest = t.briefings[t.briefings.length - 1]
                const anyStar = t.briefings.some((b) => starred.includes(b.id))
                return (
                  <article key={t.key} className="thread-row">
                    <div className="thread-name">
                      <h2 className="thread-title">{t.area}{anyStar && <StarIcon size={14} filled className="thread-star" />}</h2>
                      <p className="label">{plural(t.briefings.length, 'briefing')} · since {dayMonth(t.briefings[0].generatedAt, tz)}</p>
                    </div>
                    <ol className="thread-string">
                      {t.briefings.map((b) => {
                        const isStarred = starred.includes(b.id)
                        const style = { '--bead': `${beadSize(b)}px` } as CSSProperties
                        const cls = `bead ${hasHighAlert(b) ? 'bead-alert' : ''} ${b === latest ? 'latest' : ''}`
                        return (
                          <li key={b.id} className="bead-slot">
                            {comparing ? (
                              <button
                                type="button"
                                className={`${cls} ${selected.includes(b.id) ? 'picked' : ''}`}
                                style={style}
                                aria-pressed={selected.includes(b.id)}
                                aria-label={`Compare ${beadLabel(b)}`}
                                onClick={() => toggleSelect(b.id)}
                                data-cursor="link"
                              />
                            ) : (
                              <Link className={cls} style={style} to={`/brief/${b.id}`} aria-label={beadLabel(b)} data-cursor="link" />
                            )}
                            <span className="bead-date label" aria-hidden="true">{dayMonth(b.generatedAt, tz)}</span>
                            {!comparing && (
                              <div className="bead-pop">
                                <p className="label">{formatDateTime(b.generatedAt, tz)}</p>
                                <div className="bead-actions">
                                  <button type="button" className={`star-btn ${isStarred ? 'on' : ''}`} onClick={() => toggleStar(b.id)} aria-label={isStarred ? `Unstar ${beadLabel(b)}` : `Star ${beadLabel(b)}`} aria-pressed={isStarred} data-cursor="link">
                                    <StarIcon size={15} filled={isStarred} />
                                  </button>
                                  <button type="button" className="btn btn-quiet" onClick={() => navigate(`/brief/${b.id}?print=1`)} aria-label={`Print ${beadLabel(b)}`} data-cursor="link"><PrintIcon size={14} /></button>
                                  <button type="button" className="btn btn-quiet" onClick={() => setPendingDelete(b)} aria-label={`Delete ${beadLabel(b)}`} data-cursor="link"><TrashIcon size={14} /></button>
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ol>
                    <p className="thread-count label">{plural(latest.stats.articles, 'article')}</p>
                  </article>
                )
              })}
            </div>
          )}

          {pair.length === 2 && (
            <section className="compare-panel" aria-labelledby="compare-h">
              <h2 id="compare-h" className="label">Side by side</h2>
              <div className="compare-split">
                <CompareColumn briefing={pair[0]} timeZone={tz} />
                <CompareColumn briefing={pair[1]} timeZone={tz} />
              </div>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this briefing?"
        body={pendingDelete ? `${beadLabel(pendingDelete)} will be removed from this browser.` : ''}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
