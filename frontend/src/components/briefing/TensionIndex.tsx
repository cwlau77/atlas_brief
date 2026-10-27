import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import type { IndexItem } from '../../lib/tensionIndex'
import { formatDayMonth } from '../../lib/time'
import type { IndexHighlight } from '../../state/useIndexHighlight'
import { TextButton } from './TextButton'

const TOP = 3

/**
 * The tension index: every tension and contradiction, busiest first, saying how its sides relate
 * and naming the developments it ties to. Hover previews, click pins, Escape clears.
 */
export function TensionIndex({ id, items, highlight, timeZone, onOpen }: {
  id?: string
  items: IndexItem[]
  highlight: IndexHighlight
  timeZone: string
  /** Jumps to a development card by its anchor id ("dev-2"). */
  onOpen: (anchorId: string) => void
}) {
  const { active, pinned, pin, preview, clear } = highlight
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // Reasons measured as fitting their two-line clamp: those get no "more" toggle.
  // Unmeasured (no layout yet, jsdom, a row hidden on screen) keeps the toggle.
  const [fits, setFits] = useState<ReadonlySet<string>>(() => new Set())
  const sectionRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const next = new Set<string>()
      list.querySelectorAll<HTMLElement>('.index-why:not(.open)').forEach((p) => {
        if (p.clientHeight > 0 && p.scrollHeight <= p.clientHeight + 1 && p.dataset.key) next.add(p.dataset.key)
      })
      setFits((prev) => (prev.size === next.size && [...next].every((k) => prev.has(k)) ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [items, showAll, expanded, pinned])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) clear() }
    // Click, not pointerdown: a touch scroll that starts outside the index keeps the pin.
    // Controls that pin from elsewhere (a card's connection tag) carry data-index-control.
    const onClick = (e: Event) => {
      const target = e.target as Element | null
      if (sectionRef.current?.contains(target) || target?.closest?.('[data-index-control]')) return
      clear()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [clear])

  // A pin from elsewhere can land below the fold; show everything so the pinned row is visible.
  const pinnedHidden = pinned !== null && items.findIndex((item) => item.key === pinned) >= TOP
  // Latched: clearing the pin must not collapse rows the reader was just shown.
  useEffect(() => { if (pinnedHidden) setShowAll(true) }, [pinnedHidden])

  if (!items.length) return null
  // Rows past the top 3 stay in the DOM behind .is-overflow, so print shows every row.
  const revealed = showAll || pinnedHidden
  const hidden = revealed ? 0 : Math.max(0, items.length - TOP)
  const toggleWhy = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  // Pins the row. The second click of a double-click is ignored, so it can't unpin.
  const onRow = (e: MouseEvent, key: string) => {
    if (e.detail > 1) return
    // Unpinning by tap or keyboard: the row stops looking highlighted too.
    if (pinned === key) preview(null)
    pin(key)
  }

  return (
    <section ref={sectionRef} id={id} className="tension-index" aria-labelledby="tension-index-h">
      <h2 id="tension-index-h" className="section-label label label-mark">Tensions · {items.length}</h2>
      <ul ref={listRef} className="index-list">
        {items.map((item, i) => {
          const open = expanded.has(item.key)
          const kindStyle = item.color ? ({ '--kind': `var(${item.color.token})` } as CSSProperties) : undefined
          return (
            <li
              key={item.key}
              className={['index-item', active === item.key && 'active', pinned === item.key && 'is-pinned', !revealed && i >= TOP && 'is-overflow'].filter(Boolean).join(' ')}
              // The whole row is the target; its own buttons and links keep their jobs.
              onClick={(e) => {
                const control = (e.target as Element).closest('button, a')
                if (control && e.currentTarget.contains(control)) return
                onRow(e, item.key)
              }}
              onMouseEnter={() => preview(item.key)}
              onMouseLeave={() => preview(null)}
            >
              <button
                type="button"
                className="index-row"
                aria-pressed={pinned === item.key}
                aria-describedby={`index-why-${item.key}`}
                onClick={(e) => onRow(e, item.key)}
                onFocus={() => preview(item.key)}
                onBlur={() => preview(null)}
              >
                <span className={item.kind === 'contradiction' ? 'index-kind hot' : item.color ? 'index-kind' : 'index-kind plain'} style={kindStyle}>
                  <span className="index-kind-sq" aria-hidden="true" />
                  <span className="label">{item.kind === 'contradiction' ? 'Contradiction' : 'Tension'}</span>
                </span>
                <span className="index-sides">{item.sides}</span>
                {/* A comma for screen readers: "Houthi forces and EU-US coalition, In open conflict". */}
                {item.relation && <span className="index-relation"><span className="visually-hidden">, </span>{item.relation}</span>}
              </button>
              <p id={`index-why-${item.key}`} data-key={item.key} className={open ? 'index-why open' : 'index-why'}>{item.why}</p>
              {(open || !fits.has(item.key)) && (
                <TextButton
                  className="index-more"
                  open={open}
                  aria-expanded={open}
                  aria-controls={`index-why-${item.key}`}
                  // Label in name (WCAG 2.5.3): the accessible name starts with the visible word.
                  aria-label={`${open ? 'Less' : 'More'}: ${item.sides}`}
                  onClick={() => toggleWhy(item.key)}
                >
                  {open ? 'Less' : 'More'}
                </TextButton>
              )}
              {/* Outside the row button (buttons can't nest); the row's click handler skips these buttons, so they never pin. */}
              <div className="index-ties">
                <span className="label">Ties to</span>
                {item.linked.length ? (
                  <ul>
                    {item.linked.map((l) => (
                      <li key={l.dev}>
                        <button type="button" aria-label={`Go to development: ${l.title}`} onClick={() => onOpen(`dev-${l.dev}`)}>
                          <span className="index-tie-title">{l.title}</span>
                          <time dateTime={l.timestamp}>{formatDayMonth(l.timestamp, timeZone)}</time>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="index-ties-none">Not tied to one development in this brief</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <TextButton className="index-show" onClick={() => setShowAll(true)}>Show {hidden} more</TextButton>
      )}
    </section>
  )
}
