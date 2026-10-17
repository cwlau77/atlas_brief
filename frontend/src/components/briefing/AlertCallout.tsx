import type { ViewAlert } from '../../lib/normalize'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'

const PRIORITY: Record<ViewAlert['type'], 'high' | 'medium' | 'low'> = { urgent: 'high', warning: 'medium', info: 'low' }

export function AlertCallout({ alerts }: { alerts: ViewAlert[] }) {
  if (!alerts.length) return <p className="story-note">No priority alerts in this briefing.</p>
  return (
    <section className="alerts" aria-labelledby="alerts-h">
      <h2 id="alerts-h" className="section-label label">Priority alerts · read first</h2>
      <ul className="alert-list">
        {alerts.map((a, i) => (
          <li key={`${a.title}-${i}`} className={`alert alert-${a.type}`}>
            <PriorityMark priority={PRIORITY[a.type]} label={a.label} />
            <h3 className="alert-title">{a.title}</h3>
            <p className="alert-body">{a.description}</p>
            <SourceChips sources={a.sources} />
          </li>
        ))}
      </ul>
    </section>
  )
}
