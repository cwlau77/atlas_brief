import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { applyReadout, fmtCoord } from '../globe/readout'
import type { HotspotSnapshot, Tier } from './data'
import { GRIDS, type GridDensity, type HotspotGrid } from './grid'
import { cellScale, heatColour, heatT } from './heat'
import type { Pt } from './layout'
import './hotspots.css'

export interface HotspotsMapProps {
  snapshot: HotspotSnapshot | null // null → skeleton
  density: GridDensity
  active: string | null // iso_numeric of the hovered or pinned country
  reduced: boolean
  onHover(isoNumeric: string | null): void
  onSelect(isoNumeric: string): void // click or tap on a non-quiet country
  onQuietHover(isoNumeric: string | null, at: Pt | null): void // quiet countries: tooltip position
  onLayout(info: { scale: number; width: number; height: number }): void // px per cell, for card maths
}

/** How long the lift takes to rise and to settle back (matches .hs-lift in hotspots.css). */
const LIFT_MS = 450
const RANK: Record<Tier, number> = { quiet: 0, active: 1, elevated: 2, high: 3 }
/** Px per cell until the container has been measured. */
const DEFAULT_SCALE = 8

interface Shape {
  iso: string
  cells: number[]
  tier: Tier
  /** Ramp colour, or null for the skeleton. */
  colour: string | null
  /** Drawn cell side as a share of the slot. */
  side: number
}

interface Lift { iso: string; up: boolean }

const round = (v: number) => Math.round(v * 1000) / 1000
const articles = (n: number) => `${n} article${n === 1 ? '' : 's'}`

/** One path of the country's full-size cells, in cell units. */
function cellsPath(grid: HotspotGrid, cells: number[]): string {
  return cells.map((i) => `M${i % grid.cols},${Math.floor(i / grid.cols)}h1v1h-1z`).join('')
}

function buildShapes(grid: HotspotGrid, snapshot: HotspotSnapshot | null): Shape[] {
  const byIso = new Map(snapshot?.countries.map((c) => [c.isoNumeric, c]))
  const nMax = Math.max(0, ...(snapshot?.countries.map((c) => c.n) ?? []))
  return Object.entries(grid.cells).map(([iso, cells]) => {
    if (!snapshot) return { iso, cells, tier: 'quiet', colour: null, side: 0.5 }
    const c = byIso.get(iso)
    const t = heatT(c?.n ?? 0, snapshot.cutoffs, nMax)
    return { iso, cells, tier: c?.tier ?? 'quiet', colour: heatColour(t), side: cellScale(t) }
  })
}

function mapLabel(snapshot: HotspotSnapshot | null): string {
  const base = 'World map of news mentions in the last 24 hours.'
  const top = (snapshot?.countries ?? []).filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 3)
  if (!top.length) return base
  return `${base} Highest: ${top.map((c, i) => `${c.name}, ${i ? c.n : articles(c.n)}`).join('; ')}.`
}

function CellRects({ shape, grid }: { shape: Shape; grid: HotspotGrid }) {
  const k = shape.side
  const pad = (1 - k) / 2
  return shape.cells.map((i) => (
    <rect
      key={i}
      x={round((i % grid.cols) + pad)}
      y={round(Math.floor(i / grid.cols) + pad)}
      width={round(k)}
      height={round(k)}
      fill={shape.colour ?? undefined}
      className={shape.colour ? undefined : 'hs-skel'}
    />
  ))
}

const CountryCells = memo(function CountryCells({ shape, grid, on, delay }: { shape: Shape; grid: HotspotGrid; on: boolean; delay: number | undefined }) {
  const cls = ['hs-cg', on && 'on', delay !== undefined && 'enter'].filter(Boolean).join(' ')
  const style = delay !== undefined ? ({ '--d': String(delay) } as CSSProperties) : undefined
  return (
    <g data-iso={shape.iso} className={cls} style={style}>
      <CellRects shape={shape} grid={grid} />
    </g>
  )
})

const GlowPath = memo(function GlowPath({ shape, grid, on, filter }: { shape: Shape; grid: HotspotGrid; on: boolean; filter: string }) {
  return <path data-iso={shape.iso} className={on ? 'on' : undefined} d={cellsPath(grid, shape.cells)} fill={shape.colour ?? undefined} filter={filter} opacity={0.35} />
})

export function HotspotsMap(props: HotspotsMapProps) {
  const { snapshot, density, active, reduced } = props
  const grid = GRIDS[density]
  const wrapRef = useRef<HTMLDivElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const scaleRef = useRef(DEFAULT_SCALE)
  // Latest callbacks, so the memoised hit layer never has to re-render for new handlers.
  const cb = useRef(props)
  useLayoutEffect(() => {
    cb.current = props
  })

  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const glowId = `hs-glow-${ids}`
  const blurId = `hs-blur-${ids}`

  const shapes = useMemo(() => buildShapes(grid, snapshot), [grid, snapshot])
  const byIso = useMemo(() => new Map(shapes.map((s) => [s.iso, s])), [shapes])

  // Enter animation: decided on the first render with data, quiet countries first.
  const [delays, setDelays] = useState<Map<string, number> | null | undefined>(undefined)
  if (snapshot && delays === undefined) {
    setDelays(reduced ? null : new Map(shapes.map((s) => [s.iso, Math.round(RANK[s.tier] * 220 + Math.random() * 260)])))
  }

  // Scale: px per cell, from the container width.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      if (width <= 0) return
      const s = width / grid.cols
      scaleRef.current = s
      setScale(s)
      cb.current.onLayout({ scale: s, width, height: grid.rows * s })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [grid])

  // Lift: mount the active country's copy, raise it on the next frame, settle and unmount on leave.
  const target = active && snapshot && byIso.get(active) && byIso.get(active)!.tier !== 'quiet' ? active : null
  const [lifts, setLifts] = useState<Lift[]>([])
  useEffect(() => {
    setLifts((prev) => {
      const kept = prev.find((l) => l.iso === target)
      const next = prev.filter((l) => l.iso !== target).map((l) => (l.up ? { ...l, up: false } : l))
      if (target) next.push(reduced ? { iso: target, up: true } : (kept ?? { iso: target, up: false }))
      return reduced ? next.filter((l) => l.iso === target) : next
    })
    if (reduced) return
    let raf1 = 0
    let raf2 = 0
    if (target) {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setLifts((p) => p.map((l) => (l.iso === target ? { ...l, up: true } : l))))
      })
    }
    const settle = setTimeout(() => setLifts((p) => p.filter((l) => l.iso === target)), LIFT_MS)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      clearTimeout(settle)
    }
  }, [target, reduced])

  const backGrid = useMemo(() => {
    const d: string[] = []
    for (let x = 0; x <= grid.cols; x++) d.push(`M${x},0V${grid.rows}`)
    for (let y = 0; y <= grid.rows; y++) d.push(`M0,${y}H${grid.cols}`)
    return d.join('')
  }, [grid])

  const hits = useMemo(() => {
    if (!snapshot) return null
    const enter = (iso: string, tier: Tier) => {
      if (tier !== 'quiet') return cb.current.onHover(iso)
      const a = grid.anchors[iso]
      const s = scaleRef.current
      cb.current.onQuietHover(iso, a ? [a[0] * s, a[1] * s] : null)
    }
    const leave = (tier: Tier) => (tier === 'quiet' ? cb.current.onQuietHover(null, null) : cb.current.onHover(null))
    return shapes.map((s) => (
      <path
        key={s.iso}
        data-iso={s.iso}
        className={s.tier === 'quiet' ? 'quiet' : undefined}
        d={cellsPath(grid, s.cells)}
        onPointerEnter={() => enter(s.iso, s.tier)}
        onPointerLeave={() => leave(s.tier)}
        onClick={s.tier === 'quiet' ? undefined : () => cb.current.onSelect(s.iso)}
      />
    ))
  }, [grid, shapes, snapshot])

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const x = ((e.clientX - r.left) / r.width) * grid.cols
    const y = ((e.clientY - r.top) / r.height) * grid.rows
    const lng = grid.lngMin + x * grid.cellDeg
    const lat = grid.latMax - y * grid.cellDeg
    applyReadout(readoutRef.current, `${fmtCoord(lat, 'N', 'S')}  ${fmtCoord(lng, 'E', 'W')}`)
  }

  const svgClass = ['hs-svg', target && 'is-focus', reduced && 'is-reduced'].filter(Boolean).join(' ')
  const svgStyle = { '--px': `${1 / scale}px` } as CSSProperties

  return (
    <div className="hs-map" ref={wrapRef}>
      <svg
        className={svgClass}
        style={svgStyle}
        viewBox={`0 0 ${grid.cols} ${grid.rows}`}
        role="img"
        aria-label={mapLabel(snapshot)}
        onPointerMove={density === 'desktop' ? onPointerMove : undefined}
        onPointerLeave={density === 'desktop' ? () => applyReadout(readoutRef.current, null) : undefined}
      >
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={round(7 / scale)} />
          </filter>
          <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={round(6 / scale)} />
          </filter>
        </defs>
        <path className="hs-backgrid" d={backGrid} />
        <g className="hs-glow">
          {shapes.map((s) =>
            s.colour && s.tier === 'high' ? <GlowPath key={s.iso} shape={s} grid={grid} on={s.iso === target} filter={`url(#${glowId})`} /> : null,
          )}
        </g>
        <g className="hs-base">
          {shapes.map((s) => (
            <CountryCells key={s.iso} shape={s} grid={grid} on={s.iso === target} delay={delays?.get(s.iso)} />
          ))}
        </g>
        <g className="hs-top">
          {lifts.map((l) => {
            const s = byIso.get(l.iso)
            if (!s) return null
            const d = cellsPath(grid, s.cells)
            return (
              <g key={l.iso} data-iso={l.iso} className={l.up ? 'hs-lift up' : 'hs-lift'}>
                <path className="hs-slot" d={d} />
                <path className="hs-shadow" d={d} filter={`url(#${blurId})`} />
                <g className="hs-tile">
                  <CellRects shape={s} grid={grid} />
                </g>
              </g>
            )
          })}
        </g>
        <g className="hs-hits">{hits}</g>
      </svg>
      {density === 'desktop' ? <div className="hs-readout" ref={readoutRef} aria-hidden="true" /> : null}
    </div>
  )
}
