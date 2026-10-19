import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { formatTime, UNKNOWN_TIME } from '../../lib/time'
import { linkBriefing, linksByDevelopment, sortDevelopments, type LinkRef } from '../../lib/timeline'
import { DevelopmentCard } from './DevelopmentCard'
import { ContradictionCard, TensionCard } from './LinkedCards'

const READING_LINE = 0.6 // fraction of viewport height

export function Timeline({ briefing, timeZone, showContext, reduced }: {
  briefing: SavedBriefing
  timeZone: string
  showContext: boolean
  reduced: boolean
}) {
  const order = useMemo(() => sortDevelopments(briefing.keyDevelopments), [briefing])
  const links = useMemo(() => linkBriefing(briefing), [briefing])
  const byDev = useMemo(() => linksByDevelopment(links), [links])
  // Items that match no development keep their own section; nothing is attached at random.
  const unlinked = useMemo<LinkRef[]>(() => [
    ...links.tensions.flatMap((devs, i) => (devs.length ? [] : [{ kind: 'tension' as const, i, key: `tension-${i}` }])),
    ...links.contradictions.flatMap((devs, i) => (devs.length ? [] : [{ kind: 'contradiction' as const, i, key: `contradiction-${i}` }])),
  ], [links])

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())
  const [, setHovered] = useState<string | null>(null)
  const onToggleLink = useCallback((key: string) => setOpenKeys((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  }), [])

  const rootRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLDivElement>(null)

  // The spine's scroll progress fill and node states: unchanged from the original timeline.
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
  }, [reduced, showContext])

  if (!order.length) return <p className="story-note">This briefing has no key developments.</p>

  return (
    <div className="timeline-wrap">
      <div className="timeline" ref={rootRef}>
        <div className="spine" ref={spineRef} aria-hidden="true"><i /><b /></div>
        {order.map((entry, row) => (
          <Fragment key={entry.index}>
            <div className="t-time label" style={{ gridRow: row + 1 }}>
              {entry.time === null
                ? UNKNOWN_TIME
                : <time dateTime={entry.dev.timestamp}>{formatTime(entry.dev.timestamp, timeZone)}</time>}
            </div>
            <div className="t-node" style={{ gridRow: row + 1 }} aria-hidden="true"><span /></div>
            <DevelopmentCard
              dev={entry.dev} index={entry.index} showContext={showContext} style={{ gridRow: row + 1 }}
              links={byDev.get(entry.index) ?? []} briefing={briefing}
              openKeys={openKeys} onToggleLink={onToggleLink} onHoverLink={setHovered}
            />
          </Fragment>
        ))}
      </div>
      {unlinked.length > 0 && (
        <section className="also" aria-labelledby="also-h">
          <h2 id="also-h" className="section-label label">Also in this briefing</h2>
          <div className="also-grid">
            {unlinked.map((l) => (l.kind === 'tension'
              ? <TensionCard key={l.key} id={`link-${l.key}`} tension={briefing.emergingTensions[l.i]} />
              : <ContradictionCard key={l.key} id={`link-${l.key}`} contradiction={briefing.contradictions[l.i]} />))}
          </div>
        </section>
      )}
    </div>
  )
}
