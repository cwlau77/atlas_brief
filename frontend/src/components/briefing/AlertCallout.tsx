import { useState } from 'react'
import { cardImage } from '../../lib/cardImage'
import type { ViewAlert } from '../../lib/normalize'
import { CardImage } from './CardImage'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'
import { TextButton } from './TextButton'

const PRIORITY: Record<ViewAlert['type'], 'high' | 'medium' | 'low'> = { urgent: 'high', warning: 'medium', info: 'low' }
const TOP = 3

/** Read first: priority alerts as ruled cells, 3 shown, the rest behind "Show N more" (all print). Absent without alerts. */
export function AlertCallout({ alerts }: { alerts: ViewAlert[] }) {
  const [showAll, setShowAll] = useState(false)
  if (!alerts.length) return null
  // Alerts past the top 3 stay in the DOM behind .is-overflow, so print shows every alert.
  const hidden = showAll ? 0 : Math.max(0, alerts.length - TOP)
  return (
    <section className="alerts wrap" aria-labelledby="alerts-h">
      <h2 id="alerts-h" className="section-label label label-mark">Read first · {alerts.length} alert{alerts.length === 1 ? '' : 's'}</h2>
      <ul className="alert-list">
        {alerts.map((a, i) => (
          <li key={`${a.title}-${i}`} className={`alert alert-${a.type}${hidden && i >= TOP ? ' is-overflow' : ''}`}>
            <CardImage image={cardImage(a.sources, a.commonsImage)} variant="top" />
            <PriorityMark priority={PRIORITY[a.type]} label={a.label} />
            <h3 className="alert-title">{a.title}</h3>
            <p className="alert-body clamp-2">{a.description}</p>
            <SourceChips sources={a.sources} />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <TextButton className="alerts-show" onClick={() => setShowAll(true)}>Show {hidden} more</TextButton>
      )}
    </section>
  )
}
