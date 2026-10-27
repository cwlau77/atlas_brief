import type { FocusEvent } from 'react'
import { BASIS_LABELS, type OutlookRow } from '../../lib/outlook'
import { formatDayMonth } from '../../lib/time'
import { TiesList } from './TiesList'

/**
 * Trends & implications: what the developments add up to. Each item is either Reported (an outlet
 * says it: quoted and linked) or an Atlas assessment (dashed, naming what it reasons from).
 * Hover or focus previews its developments on the globe; there is no pinning.
 */
export function OutlookSection({ trends, implications, timeZone, preview, onOpen }: {
  trends: OutlookRow[]
  implications: OutlookRow[]
  timeZone: string
  preview: (key: string | null) => void
  /** Jumps to a development card by its anchor id ("dev-2"). */
  onOpen: (anchorId: string) => void
}) {
  if (!trends.length && !implications.length) return null

  const item = (row: OutlookRow) => {
    const date = row.source?.published_at ? formatDayMonth(row.source.published_at, timeZone) : null
    // Tabbing between the row's own controls must not flicker the preview.
    const onBlur = (e: FocusEvent<HTMLLIElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) preview(null)
    }
    return (
      <li
        key={row.key}
        className={`outlook-item ${row.basis}`}
        onMouseEnter={() => preview(row.key)}
        onMouseLeave={() => preview(null)}
        onFocus={() => preview(row.key)}
        onBlur={onBlur}
      >
        <p className="outlook-tag">
          <span className="outlook-basis label">{BASIS_LABELS[row.basis]}</span>
          {row.basis === 'reported' && row.source && (
            <a className="label" href={row.source.url} target="_blank" rel="noopener noreferrer" aria-label={`Read in ${row.source.outlet}: ${row.statement}`}>
              {date ? `${row.source.outlet} · ${date}` : row.source.outlet}
            </a>
          )}
        </p>
        <p className="outlook-statement">{row.statement}</p>
        {row.basis === 'reported' && row.quote && <q className="outlook-quote">{row.quote}</q>}
        {row.watchFor && <p className="outlook-watch"><span className="label">Watch for</span>{row.watchFor}</p>}
        <TiesList label={row.basis === 'reported' ? 'Builds on' : 'Reasoned from'} linked={row.linked} timeZone={timeZone} onJump={(dev) => {
          // As in the index: end the preview with the jump, so the scroll's leave can't retire it.
          preview(null)
          onOpen(`dev-${dev}`)
        }} />
      </li>
    )
  }

  return (
    <section id="outlook" className="outlook" aria-labelledby="outlook-h">
      <h2 id="outlook-h" className="section-label label label-mark">Trends &amp; implications</h2>
      <p className="outlook-legend">
        <span><span className="outlook-swatch reported" aria-hidden="true" />Reported: an outlet says it, quoted and linked</span>
        <span><span className="outlook-swatch assessment" aria-hidden="true" />Atlas assessment: Atlas's own reading, not reported fact</span>
      </p>
      {trends.length > 0 && (
        <>
          <h3 className="outlook-h3 label">Trends</h3>
          <ul className="outlook-list">{trends.map(item)}</ul>
        </>
      )}
      {implications.length > 0 && (
        <>
          <h3 className="outlook-h3 label">Implications</h3>
          <ul className="outlook-list">{implications.map(item)}</ul>
        </>
      )}
    </section>
  )
}
