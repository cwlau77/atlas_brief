import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { buildRoutes, routeDashArray, type Route } from '../../lib/routes'
import { formatTime, UNKNOWN_TIME } from '../../lib/time'
import { linkBriefing, linksByDevelopment, sortDevelopments, type LinkRef } from '../../lib/timeline'
import type { RouteHighlight } from '../../state/useRouteHighlight'
import { DevelopmentCard } from './DevelopmentCard'
import { ContradictionCard, TensionCard } from './LinkedCards'
import { RouteKey } from './RouteKey'

const SVG_NS = 'http://www.w3.org/2000/svg'
const READING_LINE = 0.6 // fraction of viewport height
const LANE_W = 14 // matches --t-lanes in story.css: calc(5 * 14px)
const STOP_R = 4
const NOTE_GRACE_MS = 250

interface Stop { dev: number; x: number; y: number; cardLeft: number; clientY: number }

/**
 * Where a route sits: its lane x (lane 0 nearest the spine) and each stop at
 * its node dot's height, relative to the timeline box.
 */
function measureRoute(root: HTMLElement, route: Route): Stop[] {
  const tr = root.getBoundingClientRect()
  const gap = parseFloat(getComputedStyle(root).columnGap) || 0
  const stops: Stop[] = []
  for (const dev of route.stops) {
    const node = root.querySelector<HTMLElement>(`.t-node[data-dev="${dev}"]`)
    const dot = node?.firstElementChild?.getBoundingClientRect()
    const card = document.getElementById(`dev-${dev}`)
    if (!node || !dot || !card) continue
    const x = node.getBoundingClientRect().left - tr.left - gap - LANE_W / 2 - route.lane * LANE_W
    const clientY = dot.top + dot.height / 2
    stops.push({ dev, x, y: clientY - tr.top, cardLeft: card.getBoundingClientRect().left - tr.left, clientY })
  }
  return stops
}

function svgEl(name: string, attrs: Record<string, string>, route: Route): SVGElement {
  const el = document.createElementNS(SVG_NS, name)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.dataset.route = route.key
  el.style.setProperty('--route', `var(${route.color.token})`)
  return el
}

/** Lit = hovered or opened link; when anything is lit, the other routes fade. */
function paintRoutes(svg: SVGSVGElement, lit: Set<string>) {
  const any = [...lit].some((k) => svg.querySelector(`[data-route="${k}"]`))
  svg.querySelectorAll<SVGElement>('[data-route]').forEach((el) => {
    const on = lit.has(el.dataset.route ?? '')
    el.classList.toggle('lit', on)
    el.classList.toggle('dim', any && !on)
  })
}

export function Timeline({ briefing, timeZone, showContext, reduced, highlight }: {
  briefing: SavedBriefing
  timeZone: string
  showContext: boolean
  reduced: boolean
  highlight: RouteHighlight
}) {
  const { openKeys, toggle, hovered, setHovered, lit } = highlight
  const order = useMemo(() => sortDevelopments(briefing.keyDevelopments), [briefing])
  const links = useMemo(() => linkBriefing(briefing), [briefing])
  const byDev = useMemo(() => linksByDevelopment(links), [links])
  const { routes, colorFor } = useMemo(() => buildRoutes(briefing, order), [briefing, order])
  // Items that match no development keep their own section; nothing is attached at random.
  const unlinked = useMemo<LinkRef[]>(() => [
    ...links.tensions.flatMap((devs, i) => (devs.length ? [] : [{ kind: 'tension' as const, i, key: `tension-${i}` }])),
    ...links.contradictions.flatMap((devs, i) => (devs.length ? [] : [{ kind: 'contradiction' as const, i, key: `contradiction-${i}` }])),
  ], [links])

  const rootRef = useRef<HTMLDivElement>(null)
  const spineRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const litRef = useRef(lit)
  const hoverRef = useRef(setHovered)
  const pointerY = useRef<number | null>(null)
  hoverRef.current = setHovered

  useEffect(() => {
    litRef.current = lit
    if (svgRef.current) paintRoutes(svgRef.current, lit)
  }, [lit])

  // The explain note follows the hovered route, with a short grace so the pointer can reach its Open button.
  const [noteKey, setNoteKey] = useState<string | null>(null)
  useEffect(() => {
    if (hovered && routes.some((r) => r.key === hovered)) {
      setNoteKey(hovered)
      return
    }
    const t = window.setTimeout(() => setNoteKey(null), NOTE_GRACE_MS)
    return () => window.clearTimeout(t)
  }, [hovered, routes])
  const noteRoute = routes.find((r) => r.key === noteKey) ?? null
  const [notePos, setNotePos] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !noteRoute) { setNotePos(null); return }
    const stops = measureRoute(root, noteRoute)
    if (!stops.length) { setNotePos(null); return }
    const py = pointerY.current
    const near = py === null ? stops[0] : stops.reduce((a, b) => (Math.abs(b.clientY - py) < Math.abs(a.clientY - py) ? b : a))
    setNotePos({ x: near.x, y: near.y })
  }, [noteRoute])

  // The spine's scroll progress fill and node states are unchanged; route segments draw downward the same way.
  useLayoutEffect(() => {
    const root = rootRef.current, spine = spineRef.current, svg = svgRef.current
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
      svg?.querySelectorAll<SVGPathElement>('.route-seg').forEach((p) => {
        const from = root.querySelector(`.t-node[data-dev="${p.dataset.from}"]`)
        if (from && from.getBoundingClientRect().top < line()) p.style.strokeDashoffset = '0'
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
      if (svg) {
        svg.replaceChildren()
        if (getComputedStyle(svg).display !== 'none') {
          svg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`)
          for (const r of routes) {
            const stops = measureRoute(root, r)
            for (let k = 0; k + 1 < stops.length; k++) {
              const a = stops[k], b = stops[k + 1]
              const d = `M${a.x} ${a.y} V${b.y}`
              svg.append(svgEl('path', { d, class: 'route-hit' }, r))
              const seg = svgEl('path', { d, class: 'route-seg' }, r) as SVGPathElement
              seg.dataset.from = String(a.dev)
              const len = b.y - a.y
              seg.style.strokeDasharray = routeDashArray(len, r.dashed)
              // Already-passed segments appear drawn without replaying the animation.
              const passed = reduced || a.clientY < line()
              if (passed) seg.style.transition = 'none'
              seg.style.strokeDashoffset = passed ? '0' : `${Math.round(len)}`
              svg.append(seg)
            }
            for (const s of stops) {
              svg.append(svgEl('line', { x1: `${s.x}`, y1: `${s.y}`, x2: `${s.cardLeft}`, y2: `${s.y}`, class: 'route-conn' }, r))
              svg.append(svgEl('circle', { cx: `${s.x}`, cy: `${s.y}`, r: `${STOP_R}`, class: 'route-stop' }, r))
            }
          }
          paintRoutes(svg, litRef.current)
        }
      }
      update()
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }
    const routeAt = (e: Event) => (e.target as Element | null)?.closest?.('[data-route]')?.getAttribute('data-route') ?? null
    const onOver = (e: Event) => { const k = routeAt(e); if (k) hoverRef.current(k) }
    const onOut = (e: Event) => { if (routeAt(e)) hoverRef.current(null) }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(root)
    document.fonts?.ready.then(layout)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', layout)
    svg?.addEventListener('pointerover', onOver)
    svg?.addEventListener('pointerout', onOut)
    return () => {
      alive = false
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', layout)
      svg?.removeEventListener('pointerover', onOver)
      svg?.removeEventListener('pointerout', onOut)
    }
  }, [routes, reduced, showContext])

  if (!order.length) return <p className="story-note">This briefing has no key developments.</p>

  return (
    <div className="timeline-wrap">
      <RouteKey routes={routes} lit={lit} toggle={toggle} setHovered={setHovered} />
      <div
        className="timeline" ref={rootRef}
        onPointerMove={(e) => { pointerY.current = e.clientY }}
        onPointerLeave={() => { pointerY.current = null }}
      >
        <div className="spine" ref={spineRef} aria-hidden="true"><i /><b /></div>
        {routes.length > 0 && <svg className="routes" ref={svgRef} aria-hidden="true" />}
        {order.map((entry, row) => (
          <Fragment key={entry.index}>
            <div className="t-time label" style={{ gridRow: row + 1 }}>
              {entry.time === null
                ? UNKNOWN_TIME
                : <time dateTime={entry.dev.timestamp}>{formatTime(entry.dev.timestamp, timeZone)}</time>}
            </div>
            <div className="t-node" data-dev={entry.index} style={{ gridRow: row + 1 }} aria-hidden="true"><span /></div>
            <DevelopmentCard
              dev={entry.dev} index={entry.index} showContext={showContext} style={{ gridRow: row + 1 }}
              links={byDev.get(entry.index) ?? []} briefing={briefing}
              openKeys={openKeys} onToggleLink={toggle} onHoverLink={setHovered} colorFor={colorFor} lit={lit}
            />
          </Fragment>
        ))}
        <div
          className="route-note" role="status"
          style={notePos ? { left: notePos.x, top: notePos.y } : undefined}
          onPointerEnter={() => { if (noteRoute) setHovered(noteRoute.key) }}
          onPointerLeave={() => setHovered(null)}
        >
          {noteRoute && notePos && (
            <>
              <span>
                {noteRoute.stops.length} stories share this {noteRoute.kind === 'tension' ? 'tension' : 'disagreement'}: {noteRoute.title}.
              </span>
              <button type="button" onClick={() => toggle(noteRoute.key)} data-cursor="link">
                {openKeys.has(noteRoute.key) ? 'Close' : 'Open'} ›
              </button>
            </>
          )}
        </div>
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
