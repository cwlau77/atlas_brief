import { useEffect, useState, type CSSProperties } from 'react'
import type { IndexItem } from '../../lib/tensionIndex'
import type { IndexHighlight } from '../../state/useIndexHighlight'

const TOP = 3

/** The tension index: every tension and contradiction, busiest first. Hover previews, click pins, Escape clears. */
export function TensionIndex({ items, devCount, order, highlight }: {
  items: IndexItem[]
  devCount: number
  /** Development indexes in timeline order: one strip square each. */
  order: number[]
  highlight: IndexHighlight
}) {
  const { active, pinned, pin, preview, clear } = highlight
  const [showAll, setShowAll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clear() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [clear])

  if (!items.length) return null
  const shown = showAll ? items : items.slice(0, TOP)
  const hidden = items.length - shown.length
  const toggleWhy = (key: string) => setExpanded((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })

  return (
    <section className="tension-index" aria-labelledby="tension-index-h">
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
              <p className={open ? 'index-why open' : 'index-why'}>{item.why}</p>
              <button type="button" className="index-more" aria-expanded={open} onClick={() => toggleWhy(item.key)}>
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
