import { useRef, useState, type CSSProperties } from 'react'
import { cardImage } from '../../lib/cardImage'
import type { ViewDevelopment } from '../../lib/normalize'
import { formatTime, UNKNOWN_TIME } from '../../lib/time'
import { CardImage } from './CardImage'
import { PriorityMark } from './PriorityMark'
import { SourceChips } from './SourceChips'
import { TextButton } from './TextButton'

const PRESS_FOCUS_MS = 300

export type CardHighlight = 'lit' | 'dim' | null

export function DevelopmentCard({
  dev, index, showContext, timeZone, style, connection, indexId, onTag, highlight = null, onHover, onFocusChange, onRegionTap,
}: {
  dev: ViewDevelopment
  index: number
  showContext: boolean
  timeZone: string
  style?: CSSProperties
  /** The single connection tag's label ("2 tensions"), or null for none. */
  connection: string | null
  /** The tension index's element id, which the connection tag controls. */
  indexId: string
  onTag: () => void
  highlight?: CardHighlight
  onHover?: (on: boolean) => void
  onFocusChange?: (on: boolean) => void
  onRegionTap?: () => void
}) {
  const [contextOpen, setContextOpen] = useState(false)
  // Only keyboard focus on something inside the card (a chip or button) holds the globe.
  // Focus that follows a pointer press is a click, and focus moved onto the card itself
  // (jumping to a story) is sent to the globe as a one-off request instead.
  const pressedAt = useRef(-Infinity)
  const titleId = `dev-${index}-title`
  const contextId = `dev-${index}-context`
  const image = cardImage(dev.sources, dev.commonsImage)
  const timed = !Number.isNaN(Date.parse(dev.timestamp))
  const className = ['dev', highlight === 'lit' && 'is-lit', highlight === 'dim' && 'is-dim'].filter(Boolean).join(' ')
  return (
    // data-index-control: clicks inside a card (Read background, chips) keep the index pin.
    <article
      className={className} id={`dev-${index}`} style={style} aria-labelledby={titleId} data-index-control=""
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onPointerDown={() => { pressedAt.current = performance.now() }}
      onFocus={(e) => {
        // A click focuses within the same input task as its press; allow a little slack.
        const byPointer = performance.now() - pressedAt.current < PRESS_FOCUS_MS
        pressedAt.current = -Infinity
        if (!byPointer && e.target !== e.currentTarget) onFocusChange?.(true)
      }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFocusChange?.(false) }}
    >
      <CardImage image={image} variant="side" />
      <div className="dev-main">
        <div className="dev-top">
          <PriorityMark priority={dev.priority} />
          <span className="dev-time label">
            {timed ? <time dateTime={dev.timestamp}>{formatTime(dev.timestamp, timeZone)}</time> : UNKNOWN_TIME}
          </span>
          {dev.regions.length > 0 && (
            <ul className="tags label" aria-label="Regions">
              {dev.regions.map((r) => (
                <li key={r}><button type="button" className="chip" data-index-control="" onClick={() => onRegionTap?.()}>{r}</button></li>
              ))}
            </ul>
          )}
        </div>
        <h3 id={titleId} className="dev-title">{dev.title}</h3>
        <p className="dev-body">{dev.content}</p>
        {showContext && dev.historicalContext && (
          <div className="dev-context">
            <span className="label">From the archive</span>
            {contextOpen
              ? <p id={contextId} className="dev-context-full">{dev.historicalContext}</p>
              : <p className="dev-context-teaser" aria-hidden="true">{dev.historicalContext}</p>}
            <TextButton
              open={contextOpen}
              aria-expanded={contextOpen}
              aria-controls={contextOpen ? contextId : undefined}
              onClick={() => setContextOpen((o) => !o)}
            >
              {contextOpen ? 'Show less' : 'Read background'}
            </TextButton>
          </div>
        )}
        <SourceChips sources={dev.sources} />
        {connection && (
          <button type="button" className="dev-conn chip" data-index-control="" aria-controls={indexId}
            aria-label={`Show in tension index: ${connection}`} onClick={onTag}
          >
            {connection}
          </button>
        )}
      </div>
    </article>
  )
}
