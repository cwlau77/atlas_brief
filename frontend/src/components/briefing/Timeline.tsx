import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { formatTime, UNKNOWN_TIME } from '../../lib/time'
import { firstLinkedRow, linkBriefing, sortDevelopments } from '../../lib/timeline'
import { DevelopmentCard } from './DevelopmentCard'
import { ContradictionCard, TensionCard } from './LinkedCards'

const SVG_NS = 'http://www.w3.org/2000/svg'
const READING_LINE = 0.6 // fraction of viewport height

interface LinkedItem { key: string; kind: 'tension' | 'contradiction'; i: number }
interface Branch { from: string; to: string }

export function Timeline({ briefing, timeZone, showContext, reduced }: {
  briefing: SavedBriefing
  timeZone: string
  showContext: boolean
  reduced: boolean
}) {
  const order = useMemo(() => sortDevelopments(briefing.keyDevelopments), [briefing])
  const links = useMemo(() => linkBriefing(briefing), [briefing])

  // Each linked card sits in the row of its earliest related development.
  const { byRow, unlinked, branches } = useMemo(() => {
    const byRow = new Map<number, LinkedItem[]>()
    const unlinked: LinkedItem[] = []
    const branches: Branch[] = []
    const place = (kind: LinkedItem['kind'], list: number[][]) => {
      list.forEach((devs, i) => {
        const item = { key: `${kind}-${i}`, kind, i }
        const row = firstLinkedRow(devs, order)
        if (row === null) {
          unlinked.push(item)
          return
        }
        byRow.set(row, [...(byRow.get(row) ?? []), item])
        for (const d of devs) branches.push({ from: `dev-${d}`, to: `link-${item.key}` })
      })
    }
    place('tension', links.tensions)
    place('contradiction', links.contradictions)
    return { byRow, unlinked, branches }
  }, [links, order])

  const rootRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current, spine = spineRef.current, svg = svgRef.current
    if (!root || !spine || !svg) return
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
      svg.querySelectorAll<SVGPathElement>('.branch-lit').forEach((p) => {
        const dev = document.getElementById(p.dataset.from ?? '')
        if (dev && dev.getBoundingClientRect().top < line()) p.style.strokeDashoffset = '0'
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
      svg.replaceChildren()
      if (getComputedStyle(svg).display !== 'none') {
        svg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`)
        for (const br of branches) {
          const from = document.getElementById(br.from), to = document.getElementById(br.to)
          if (!from || !to) continue
          const fa = from.getBoundingClientRect(), ta = to.getBoundingClientRect()
          const x1 = fa.right - tr.left, y1 = fa.top + Math.min(44, fa.height / 2) - tr.top
          const x2 = ta.left - tr.left, y2 = ta.top + Math.min(30, ta.height / 2) - tr.top
          const mx = (x1 + x2) / 2
          const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} C${mx.toFixed(1)} ${y1.toFixed(1)}, ${mx.toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
          const track = document.createElementNS(SVG_NS, 'path')
          track.setAttribute('d', d)
          track.setAttribute('class', 'branch-track')
          const lit = document.createElementNS(SVG_NS, 'path')
          lit.setAttribute('d', d)
          lit.setAttribute('class', 'branch-lit')
          lit.dataset.from = br.from
          svg.append(track, lit)
          const len = lit.getTotalLength()
          lit.style.strokeDasharray = `${len}`
          // Already-passed branches appear drawn without replaying the animation.
          const passed = reduced || fa.top < line()
          if (passed) lit.style.transition = 'none'
          lit.style.strokeDashoffset = passed ? '0' : `${len}`
        }
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
  }, [branches, reduced, showContext])

  const renderLinked = (item: LinkedItem) =>
    item.kind === 'tension'
      ? <TensionCard key={item.key} id={`link-${item.key}`} tension={briefing.emergingTensions[item.i]} />
      : <ContradictionCard key={item.key} id={`link-${item.key}`} contradiction={briefing.contradictions[item.i]} />

  if (!order.length) return <p className="story-note">This briefing has no key developments.</p>

  return (
    <div className="timeline-wrap">
      <div className="timeline" ref={rootRef}>
        <div className="spine" ref={spineRef} aria-hidden="true"><i /><b /></div>
        <svg className="branches" ref={svgRef} aria-hidden="true" />
        {order.map((entry, row) => (
          <Fragment key={entry.index}>
            <div className="t-time label" style={{ gridRow: row + 1 }}>
              {entry.time === null
                ? UNKNOWN_TIME
                : <time dateTime={entry.dev.timestamp}>{formatTime(entry.dev.timestamp, timeZone)}</time>}
            </div>
            <div className="t-node" style={{ gridRow: row + 1 }} aria-hidden="true"><span /></div>
            <DevelopmentCard dev={entry.dev} index={entry.index} showContext={showContext} style={{ gridRow: row + 1 }} />
            {byRow.has(row) && (
              <div className="t-links" style={{ gridRow: row + 1 }}>
                {byRow.get(row)!.map(renderLinked)}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {unlinked.length > 0 && (
        <section className="also" aria-labelledby="also-h">
          <h2 id="also-h" className="section-label label">Also in this briefing</h2>
          <div className="also-grid">{unlinked.map(renderLinked)}</div>
        </section>
      )}
    </div>
  )
}
