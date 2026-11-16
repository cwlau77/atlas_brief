import { figureGroups, type ChartRow } from '../../lib/keyFigures'
import type { ViewKeyFigure } from '../../lib/normalize'

/**
 * A development's key figures, each copied word for word from an article the card cites and
 * attributed to it. Comparable figures get bars (one scale from zero) or 0–100% meters in the same
 * rows; the list itself is the chart's table, so no value hides behind hover.
 */
export function KeyFigures({ figures, timeZone }: { figures: ViewKeyFigure[]; timeZone: string }) {
  if (!figures.length) return null
  const { chart, plain } = figureGroups(figures, timeZone)

  // The article is one of the card's source chips, so the figure only names its outlet, and only
  // where several figures sit side by side and the reader needs to tell them apart.
  const what = (f: ViewKeyFigure) => (
    <span className="kf-what">
      {f.label}
      {f.period && <span className="kf-period">, {f.period}</span>}
      {figures.length > 1 && <span className="kf-src">, {f.source.outlet}</span>}
    </span>
  )

  const chartRow = ({ figure, width, note }: ChartRow, i: number) => (
    <li key={`c${i}`} className="kf-row">
      <span className="kf-fig">{figure.figure}</span>
      <span className={`kf-bar${chart?.scale === 'meter' && width !== null ? ' meter' : ''}${width === null ? ' none' : ''}`} aria-hidden="true">
        {width !== null ? <b style={{ width: `${width}%` }} /> : note}
      </span>
      {what(figure)}
    </li>
  )

  const plainRow = (f: ViewKeyFigure, i: number) => (
    <li key={`p${i}`} className="kf-row plain">
      <span className="kf-fig">{f.figure}</span>
      {what(f)}
    </li>
  )

  return (
    <div className="kf">
      <p className="kf-h label">Key figures</p>
      {chart && (
        <>
          <ul className="kf-list kf-chart" aria-label="Key figures">{chart.rows.map(chartRow)}</ul>
          <p className="kf-cap">{chart.caption}</p>
        </>
      )}
      {plain.length > 0 && (
        <ul className="kf-list" aria-label={chart ? 'More key figures' : 'Key figures'}>{plain.map(plainRow)}</ul>
      )}
    </div>
  )
}
