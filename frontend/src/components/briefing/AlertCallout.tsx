import { useLayoutEffect, useRef, useState } from 'react'
import { cardImages } from '../../lib/cardImage'
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
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  // Summaries measured as fitting their two-line clamp get no toggle. Unmeasured (no layout yet,
  // jsdom, an alert hidden behind "Show more") keeps it, as in the tension index.
  const [fits, setFits] = useState<ReadonlySet<number>>(() => new Set())
  const listRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const next = new Set<number>()
      list.querySelectorAll<HTMLElement>('.alert-body:not(.open)').forEach((p) => {
        if (p.clientHeight > 0 && p.scrollHeight <= p.clientHeight + 1) next.add(Number(p.dataset.i))
      })
      setFits((prev) => (prev.size === next.size && [...next].every((k) => prev.has(k)) ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [alerts, showAll, expanded])

  if (!alerts.length) return null
  const toggle = (i: number) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(i)) next.add(i)
    return next
  })
  // Alerts past the top 3 stay in the DOM behind .is-overflow, so print shows every alert.
  const hidden = showAll ? 0 : Math.max(0, alerts.length - TOP)
  return (
    <section className="alerts wrap" aria-labelledby="alerts-h">
      <h2 id="alerts-h" className="section-label label label-mark">Read first · {alerts.length} alert{alerts.length === 1 ? '' : 's'}</h2>
      <ul className="alert-list" ref={listRef}>
        {alerts.map((a, i) => (
          <li key={`${a.title}-${i}`} className={`alert alert-${a.type}${hidden && i >= TOP ? ' is-overflow' : ''}`}>
            <CardImage images={cardImages(a.sources, a.commonsImage)} variant="top" />
            <PriorityMark priority={PRIORITY[a.type]} label={a.label} />
            <h3 className="alert-title">{a.title}</h3>
            <p id={`alert-body-${i}`} data-i={i} className={expanded.has(i) ? 'alert-body open' : 'alert-body clamp-2'}>{a.description}</p>
            {(expanded.has(i) || !fits.has(i)) && (
              <TextButton
                className="alert-more"
                open={expanded.has(i)}
                aria-expanded={expanded.has(i)}
                aria-controls={`alert-body-${i}`}
                // Label in name (WCAG 2.5.3): the accessible name starts with the visible word.
                aria-label={`${expanded.has(i) ? 'Less' : 'More'}: ${a.title}`}
                onClick={() => toggle(i)}
              >
                {expanded.has(i) ? 'Less' : 'More'}
              </TextButton>
            )}
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
