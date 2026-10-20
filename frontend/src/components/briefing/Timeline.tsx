import { useLayoutEffect, useMemo, useRef } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { connectionLabel, type IndexItem } from '../../lib/tensionIndex'
import { sortNewestFirst } from '../../lib/timeline'
import type { IndexHighlight } from '../../state/useIndexHighlight'
import { DevelopmentCard, type CardHighlight } from './DevelopmentCard'

const READING_LINE = 0.6 // fraction of viewport height
const INDEX_ID = 'tension-index'

/** Key developments, newest first, on a spine that fills as the reader scrolls past each node. */
export function Timeline({ briefing, timeZone, showContext, reduced, items, highlight, onCardHover, onCardFocus, onTagTap }: {
  briefing: SavedBriefing
  timeZone: string
  showContext: boolean
  reduced: boolean
  /** The tension index's items: they name each card's connection tag and light the cards. */
  items: IndexItem[]
  highlight: IndexHighlight
  onCardHover: (devIndex: number | null) => void
  onCardFocus: (devIndex: number | null) => void
  /** A card's region tag was tapped. */
  onTagTap: (devIndex: number) => void
}) {
  const order = useMemo(() => sortNewestFirst(briefing.keyDevelopments), [briefing])
  // An item linked to no card lights nothing rather than dimming every card.
  const activeItem = items.find((item) => item.key === highlight.active && item.devs.length > 0) ?? null
  const { pinned, pin } = highlight

  // Scrolls to the index and pins the busiest item linked to the card. Never unpins.
  const onTag = (devIndex: number) => {
    const first = items.find((item) => item.devs.includes(devIndex))
    if (!first) return
    document.getElementById(INDEX_ID)?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    if (pinned !== first.key) pin(first.key)
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLDivElement>(null)

  // The spine's scroll progress fill and node states.
  useLayoutEffect(() => {
    const root = rootRef.current, spine = spineRef.current
    if (!root || !spine) return
    let alive = true
    let raf = 0
    const geometry = { top: 0, bottom: 0 }
    const line = () => window.innerHeight * READING_LINE

    const update = () => {
      const tr = root.getBoundingClientRect()
      const fill = Math.max(0, Math.min(geometry.bottom - geometry.top, line() - (tr.top + geometry.top)))
      spine.style.setProperty('--fill', `${fill}px`)
      root.querySelectorAll<HTMLElement>('.t-node').forEach((n) => {
        const dot = n.firstElementChild?.getBoundingClientRect()
        if (dot) n.classList.toggle('on', dot.top + dot.height / 2 < line())
      })
    }

    const layout = () => {
      if (!alive) return
      const tr = root.getBoundingClientRect()
      const dots = root.querySelectorAll<HTMLElement>('.t-node span')
      if (dots.length) {
        const a = dots[0].getBoundingClientRect(), b = dots[dots.length - 1].getBoundingClientRect()
        geometry.top = a.top + a.height / 2 - tr.top
        geometry.bottom = b.top + b.height / 2 - tr.top
        spine.style.top = `${geometry.top}px`
        spine.style.height = `${Math.max(0, geometry.bottom - geometry.top)}px`
      }
      update()
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(root)
    document.fonts?.ready.then(layout)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', layout)
    return () => {
      alive = false
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', layout)
    }
  }, [order, showContext])

  if (!order.length) return <p className="story-note">This briefing has no key developments.</p>

  return (
    <div className="timeline" ref={rootRef}>
      <div className="spine" ref={spineRef} aria-hidden="true"><i /><b /></div>
      {order.map((entry, row) => {
        const state: CardHighlight = activeItem ? (activeItem.devs.includes(entry.index) ? 'lit' : 'dim') : null
        return [
          <div key={`node-${entry.index}`} className="t-node" data-dev={entry.index} style={{ gridRow: row + 1 }} aria-hidden="true"><span /></div>,
          <DevelopmentCard
            key={`dev-${entry.index}`}
            dev={entry.dev} index={entry.index} showContext={showContext} timeZone={timeZone} style={{ gridRow: row + 1 }}
            connection={connectionLabel(items, entry.index)} onTag={() => onTag(entry.index)} highlight={state}
            onHover={(on) => onCardHover(on ? entry.index : null)}
            onFocusChange={(on) => onCardFocus(on ? entry.index : null)}
            onRegionTap={() => onTagTap(entry.index)}
          />,
        ]
      })}
    </div>
  )
}
