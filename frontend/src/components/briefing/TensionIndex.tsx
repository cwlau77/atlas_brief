import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { IndexItem } from '../../lib/tensionIndex'
import type { IndexHighlight } from '../../state/useIndexHighlight'

const TOP = 3

/** The tension index: every tension and contradiction, busiest first. Hover previews, click pins, Escape clears. */
export function TensionIndex({ id, items, devCount, order, highlight }: {
  id?: string
  items: IndexItem[]
  devCount: number
  /** Development indexes in timeline order: one strip square each. */
  order: number[]
  highlight: IndexHighlight
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

  if (!items.length) return null
  // A pin from elsewhere can land below the fold; show everything so the pinned row is visible.
  const pinnedHidden = pinned !== null && items.findIndex((item) => item.key === pinned) >= TOP
  // Rows past the top 3 stay in the DOM behind .is-overflow, so print shows every row.
  const revealed = showAll || pinnedHidden
  const hidden = revealed ? 0 : Math.max(0, items.length - TOP)
  const toggleWhy = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  return (
    <section ref={sectionRef} id={id} className="tension-index" aria-labelledby="tension-index-h">
      <h2 id="tension-index-h" className="section-label label label-mark">Tensions · {items.length}</h2>
      <ul ref={listRef} className="index-list">
        {items.map((item, i) => {
          const open = expanded.has(item.key)
          const kindStyle = item.color ? ({ '--kind': `var(${item.color.token})` } as CSSProperties) : undefined
          return (
            <li key={item.key} className={['index-item', active === item.key && 'active', !revealed && i >= TOP && 'is-overflow'].filter(Boolean).join(' ')}>
              <button
                type="button"
                className="index-row"
                aria-pressed={pinned === item.key}
                aria-describedby={`index-why-${item.key}`}
                onClick={() => {
                  // Unpinning by tap or keyboard: the row stops looking highlighted too.
                  if (pinned === item.key) preview(null)
                  pin(item.key)
                }}
                onMouseEnter={() => preview(item.key)}
                onMouseLeave={() => preview(null)}
                onFocus={() => preview(item.key)}
                onBlur={() => preview(null)}
              >
                <span className={item.kind === 'contradiction' ? 'index-kind hot' : item.color ? 'index-kind' : 'index-kind plain'} style={kindStyle}>
                  <span className="index-kind-sq" aria-hidden="true" />
                  <span className="label">{item.kind === 'contradiction' ? 'Contradiction' : 'Tension'}</span>
                </span>
                <span className="index-sides">{item.sides}</span>
                <span className="index-strip" role="img" aria-label={`Linked to ${item.devs.length} of ${devCount} developments`}>
                  {order.map((d) => <i key={d} className={item.devs.includes(d) ? 'on' : undefined} />)}
                </span>
              </button>
              <p id={`index-why-${item.key}`} data-key={item.key} className={open ? 'index-why open' : 'index-why'}>{item.why}</p>
              {(open || !fits.has(item.key)) && (
                <button
                  type="button"
                  className="index-more"
                  aria-expanded={open}
                  aria-controls={`index-why-${item.key}`}
                  // Label in name (WCAG 2.5.3): the accessible name starts with the visible word.
                  aria-label={`${open ? 'less' : 'more'}: ${item.sides}`}
                  onClick={() => toggleWhy(item.key)}
                >
                  {open ? 'less' : 'more'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {hidden > 0 && (
        <button type="button" className="index-show" onClick={() => setShowAll(true)}>Show {hidden} more</button>
      )}
    </section>
  )
}
