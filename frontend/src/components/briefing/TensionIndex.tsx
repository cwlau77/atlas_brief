import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

  const sectionRef = useRef<HTMLElement>(null)

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
  const shown = showAll || pinnedHidden ? items : items.slice(0, TOP)
  const hidden = items.length - shown.length
  const toggleWhy = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  return (
    <section ref={sectionRef} id={id} className="tension-index" aria-labelledby="tension-index-h">
      <h2 id="tension-index-h" className="section-label label label-mark">Tensions · {items.length}</h2>
      <ul className="index-list">
        {shown.map((item) => {
          const open = expanded.has(item.key)
          const kindStyle = item.color ? ({ '--kind': `var(${item.color.token})` } as CSSProperties) : undefined
          return (
            <li key={item.key} className={active === item.key ? 'index-item active' : 'index-item'}>
              <button
                type="button"
                className="index-row"
                aria-pressed={pinned === item.key}
                aria-describedby={`index-why-${item.key}`}
                onClick={() => pin(item.key)}
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
              <p id={`index-why-${item.key}`} className={open ? 'index-why open' : 'index-why'}>{item.why}</p>
              <button
                type="button"
                className="index-more"
                aria-expanded={open}
                aria-controls={`index-why-${item.key}`}
                aria-label={`${open ? 'Show less' : 'Show full reason'}: ${item.sides}`}
                onClick={() => toggleWhy(item.key)}
              >
                {open ? 'less' : 'more'}
              </button>
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
