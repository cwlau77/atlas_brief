import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { applyReadout, formatReadout } from './readout'
import { formatTime } from '../lib/time'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { attachDrag } from './controls'
import { slerpArc, type GlobeArc } from './arcs'
import { GlobeEngine, type GlobeHotspot } from './engine'
import { feedCity } from './feedCities'
import type { FollowTarget, LatLng } from './follow'
import { pointKey, toVec3, topRegion, type RegionPoint } from './regions'
import { StaticGlobe } from './StaticGlobe'
import './globe.css'

// Decorative hero points: Bab el-Mandeb, Suez, Rotterdam, Singapore.
const HERO_HOTSPOTS: GlobeHotspot[] = [
  { lat: 12.6, lng: 43.3, count: 3 },
  { lat: 30.0, lng: 32.5, count: 2 },
  { lat: 51.9, lng: 4.4, count: 2 },
  { lat: 1.3, lng: 103.8, count: 2 },
]
const NO_REGIONS: RegionPoint[] = []
// The loading arcs are ultramarine: --accent, which --route-1 mirrors as a hex for WebGL.
const ACCENT_HEX = '#1F3FE0'
const CLOSE_DELAY_MS = 160
const LABELED_COUNT = 5

export interface GlobeViewProps {
  mode: 'hero' | 'briefing'
  label: string
  regions?: RegionPoint[]
  timeZone?: string
  playIntro?: boolean
  scanning?: boolean
  onSelectStory?: (anchorId: string) => void
  /** Briefing mode: clicking a point (or Back/Esc/ocean) reports the point to open, or null to close. */
  onFocusPoint?: (point: RegionPoint | null) => void
  /** Briefing mode: the pointKey of the point the camera is zoomed to; null zooms back out. */
  zoomedTo?: string | null
  /** Briefing mode: route arcs, the route keys lit elsewhere on the page, and arc hover reports. */
  arcs?: GlobeArc[]
  litArcs?: Set<string>
  onArcHover?: (key: string | null) => void
  /**
   * Briefing mode: what the reader is on. One point zooms to it and lights markerKey;
   * several are framed (the overview when spread too wide); null zooms out.
   * zoomedTo (the open carousel) wins over it.
   */
  follow?: FollowTarget
  /**
   * Hero mode, while a briefing builds: the story's place (null when it has none) and the
   * newsroom feeds that returned articles. A target is flown to with arcs from the feeds'
   * home cities; with none, those cities light up instead.
   */
  loading?: { target: LatLng | null; feedOutlets: string[] }
}

const NO_ARCS: GlobeArc[] = []
const NOTHING_LIT = new Set<string>()

// A press that moves further than this is a drag, not a click on the ocean.
const CLICK_SLOP_PX = 5

export default function GlobeView({
  mode, label, regions = NO_REGIONS, timeZone = 'auto', playIntro = false, scanning = false, onSelectStory,
  onFocusPoint, zoomedTo = null, arcs = NO_ARCS, litArcs = NOTHING_LIT, onArcHover, follow = null, loading,
}: GlobeViewProps) {
  const reduced = usePrefersReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const hotRefs = useRef<(HTMLButtonElement | null)[]>([])
  const readoutRef = useRef<HTMLSpanElement>(null)
  const engineRef = useRef<GlobeEngine | null>(null)
  const size = useRef({ w: 1, h: 1 })
  const live = useRef({ active: null as number | null, pinned: false })
  const closeTimer = useRef(0)
  const playIntroRef = useRef(playIntro)
  const pressAt = useRef<{ x: number; y: number } | null>(null)
  const [engineVersion, setEngineVersion] = useState(0)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const target = mode === 'hero' ? loading?.target ?? null : null
  const feedKey = mode === 'hero' && loading ? loading.feedOutlets.join('|') : ''
  const feedCities = useMemo(() => {
    const seen = new Map<string, LatLng>()
    for (const outlet of feedKey ? feedKey.split('|') : []) {
      const city = feedCity(outlet)
      if (city) seen.set(`${city.lat},${city.lng}`, city)
    }
    return [...seen.values()]
  }, [feedKey])
  const loadingSpots: GlobeHotspot[] | null = !loading || mode !== 'hero'
    ? null
    : target ? [{ ...target, count: 3 }] : feedCities.length ? feedCities.map((c) => ({ ...c, count: 2 })) : null
  const spots: GlobeHotspot[] = mode === 'hero'
    ? loadingSpots ?? HERO_HOTSPOTS
    : regions.map((r) => ({ lat: r.lat, lng: r.lng, count: r.count }))
  const spotsKey = spots.map((s) => `${s.lat},${s.lng},${s.count}`).join('|')
  // Read inside the hotspot-push effect below, which intentionally keys off spotsKey
  // (a stable primitive) rather than the spots/regions array identities, which change every render.
  const latest = useRef({ spots, regions })
  latest.current = { spots, regions }

  useEffect(() => {
    live.current.active = active
    live.current.pinned = pinned
  }, [active, pinned])

  // Create the engine. Recreated only when the mode or reduced-motion preference changes.
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const readoutEl = readoutRef.current
    if (!canvas || !wrap) return
    let engine: GlobeEngine
    try {
      engine = new GlobeEngine(canvas, { reducedMotion: reduced, playIntro: playIntroRef.current, baseSpin: mode === 'hero' ? 0.045 : 0.03 })
    } catch {
      setFailed(true)
      return
    }
    engineRef.current = engine

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      size.current = { w: width, h: height }
      engine.setSize(width, height)
    })
    ro.observe(wrap)
    const io = new IntersectionObserver(([entry]) => engine.setRunning(entry.isIntersecting))
    io.observe(wrap)
    const detach = attachDrag(wrap, engine)
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      engine.setPointer({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 })
    }
    const onLeave = () => engine.setPointer(null)
    wrap.addEventListener('pointermove', onMove, { passive: true })
    wrap.addEventListener('pointerleave', onLeave)

    engine.onFrame = ({ hotspots, pointer }) => {
      applyReadout(readoutEl, pointer && formatReadout(pointer.lat, pointer.lng, new Date()))
      hotspots.forEach((h, i) => {
        const el = hotRefs.current[i]
        if (!el) return
        el.style.transform = `translate3d(${h.x.toFixed(1)}px, ${h.y.toFixed(1)}px, 0)`
        el.dataset.visible = String(h.visible)
      })
      const panel = panelRef.current
      const a = live.current.active
      if (panel && a !== null && hotspots[a]) {
        const h = hotspots[a]
        const flipX = h.x > size.current.w * 0.55
        const flipY = h.y > size.current.h * 0.6
        panel.style.transform =
          `translate3d(${(flipX ? h.x - 18 : h.x + 18).toFixed(1)}px, ${(flipY ? h.y + 12 : h.y - 12).toFixed(1)}px, 0) ` +
          `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`
        panel.dataset.visible = String(h.visible || live.current.pinned)
      }
    }
    setEngineVersion((v) => v + 1)

    return () => {
      applyReadout(readoutEl, null)
      ro.disconnect()
      io.disconnect()
      detach()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
      engine.dispose()
      engineRef.current = null
    }
  }, [mode, reduced])

  // Push hotspots whenever they change (or the engine was recreated).
  // spots and regions are read through spotsKey, which changes whenever they do.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const { spots, regions } = latest.current
    engine.setHotspots(spots)
    hotRefs.current.length = spots.length
    const top = mode === 'briefing' ? topRegion(regions) : null
    if (top) engine.focusOn(top.lat, top.lng)
    setActive(null)
    setPinned(false)
    setFocusedIndex(null)
  }, [spotsKey, engineVersion, mode])

  // Zoom follows zoomedTo, else the reader (follow). Runs after the hotspot push above,
  // so a zoom wins over its default focus.
  const zoomable = mode === 'briefing' && !!onFocusPoint
  const following = mode === 'briefing' ? follow : null
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || mode !== 'briefing') return
    const point = zoomable ? latest.current.regions.find((r) => pointKey(r) === zoomedTo) : undefined
    if (point) engine.zoomTo(point.lat, point.lng)
    else if (following?.points.length) engine.frame(following.points)
    else if (engine.isZoomed) engine.zoomOut()
  }, [zoomedTo, zoomable, following, mode, spotsKey, engineVersion])

  // The followed marker is lit and the others dimmed, unless a carousel point is open.
  // A marker key with no globe point (a region missing from the counts) emphasises nothing.
  const wantKey = zoomedTo === null ? following?.markerKey ?? null : null
  const followKey = wantKey !== null && regions.some((r) => pointKey(r) === wantKey) ? wantKey : null
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const i = followKey === null ? -1 : latest.current.regions.findIndex((r) => pointKey(r) === followKey)
    engine.setEmphasis(i < 0 ? null : i)
  }, [followKey, spotsKey, engineVersion])

  useEffect(() => {
    if (!zoomable || zoomedTo === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFocusPoint?.(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zoomable, zoomedTo, onFocusPoint])

  // A newly named place is flown to once; dragging away from it afterwards is the reader's call.
  const targetLat = target?.lat
  const targetLng = target?.lng
  useEffect(() => {
    if (targetLat !== undefined && targetLng !== undefined) engineRef.current?.focusOn(targetLat, targetLng)
  }, [targetLat, targetLng, engineVersion])

  const loadingArcs = useMemo(() => {
    if (targetLat === undefined || targetLng === undefined) return NO_ARCS
    const to = toVec3(targetLat, targetLng)
    return feedCities
      .filter((c) => c.lat !== targetLat || c.lng !== targetLng)
      .map((c) => ({ key: `feed:${c.lat},${c.lng}`, color: ACCENT_HEX, dashed: false, points: slerpArc(toVec3(c.lat, c.lng), to, 48, 0.12) }))
  }, [feedCities, targetLat, targetLng])
  const shownArcs = mode === 'briefing' ? arcs : loadingArcs
  // The loading screen's arcs draw in from the newsrooms ("watch the sweep"); route arcs appear whole.
  useEffect(() => { engineRef.current?.setArcs(shownArcs, mode === 'hero') }, [shownArcs, mode, engineVersion])
  useEffect(() => { engineRef.current?.setLitArcs(litArcs) }, [litArcs, engineVersion])
  const arcHoverRef = useRef(onArcHover)
  useEffect(() => {
    arcHoverRef.current = onArcHover
    const engine = engineRef.current
    if (engine) engine.onArcHover = (key) => arcHoverRef.current?.(key)
  }, [onArcHover, engineVersion])

  useEffect(() => { engineRef.current?.setScanning(scanning) }, [scanning, engineVersion])
  // Hold auto-spin while a hotspot is pinned open, a hotspot/the panel has keyboard focus,
  // the globe is following the reader, or it has flown to a loading briefing's place.
  const holdForFollow = !!following || target !== null
  useEffect(() => {
    engineRef.current?.setHold(pinned || focusedIndex !== null || holdForFollow)
  }, [pinned, focusedIndex, holdForFollow, engineVersion])

  const open = useCallback((i: number) => {
    window.clearTimeout(closeTimer.current)
    setActive(i)
  }, [])
  const scheduleClose = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setActive(null), CLOSE_DELAY_MS)
  }, [])
  const closeAll = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    setPinned(false)
    setActive(null)
  }, [])
  const togglePin = (i: number) => {
    window.clearTimeout(closeTimer.current)
    if (pinned && active === i) closeAll()
    else {
      setActive(i)
      setPinned(true)
    }
  }
  const select = (anchorId: string) => {
    closeAll()
    onSelectStory?.(anchorId)
  }
  const focusPoint = (point: RegionPoint) => {
    closeAll()
    onFocusPoint?.(point)
  }
  // On the wrapper, not the canvas: attachDrag captures the pointer there, so that is where click lands.
  const onGlobeClick = (e: MouseEvent<HTMLDivElement>) => {
    const start = pressAt.current
    pressAt.current = null
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!zoomable || zoomedTo === null || !engine || !canvas || !start) return
    if ((e.target as HTMLElement).closest('button, a, .globe-panel')) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return
    const r = canvas.getBoundingClientRect()
    const ndc = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }
    if (engine.isEmptyAt(ndc)) onFocusPoint?.(null)
  }

  useEffect(() => {
    if (!pinned) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll() }
    const onDown = (e: PointerEvent) => { if (!wrapRef.current?.contains(e.target as Node)) closeAll() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [pinned, closeAll])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  if (failed) return <StaticGlobe label={label} regions={mode === 'briefing' ? regions : []} onSelectStory={onSelectStory} />

  const current = active !== null ? regions[active] : undefined

  return (
    <div
      className={`globe-view globe-${mode}`} ref={wrapRef}
      onPointerDown={(e) => { pressAt.current = { x: e.clientX, y: e.clientY } }}
      onClick={onGlobeClick}
    >
      <canvas ref={canvasRef} className="globe-canvas" role="img" aria-label={label} />
      <span className="globe-readout" aria-hidden="true" ref={readoutRef} data-visible="false" />
      {mode === 'briefing' && (
        <>
          <div className="globe-hotspots">
            {regions.map((r, i) => (
              <button
                key={pointKey(r)}
                ref={(el) => { hotRefs.current[i] = el }}
                type="button"
                className={`globe-hotspot ${i < LABELED_COUNT ? 'labeled' : ''} ${pointKey(r) === zoomedTo ? 'zoomed' : ''} ${followKey !== null ? (pointKey(r) === followKey ? 'followed' : 'unfollowed') : ''}`}
                data-visible="false"
                aria-label={`${r.name}, ${r.count} mention${r.count === 1 ? '' : 's'}. Show stories.`}
                aria-expanded={active === i}
                aria-controls="globe-panel"
                onPointerEnter={() => { if (!pinned && zoomedTo === null) open(i) }}
                onPointerLeave={() => { if (!pinned) scheduleClose() }}
                onFocus={() => {
                  setFocusedIndex(i)
                  engineRef.current?.focusOn(r.lat, r.lng)
                  if (!pinned && zoomedTo === null) open(i)
                }}
                onBlur={(e) => {
                  if (wrapRef.current?.contains(e.relatedTarget as Node)) return
                  setFocusedIndex(null)
                  if (!pinned) scheduleClose()
                }}
                onClick={() => (zoomable ? focusPoint(r) : togglePin(i))}
              >
                <span className="globe-hotspot-label label">{r.name}<b>{r.count}</b></span>
              </button>
            ))}
          </div>
          {current && (
            <div
              id="globe-panel"
              ref={panelRef}
              className="globe-panel"
              data-visible="false"
              role="dialog"
              aria-label={`Stories in ${current.name}`}
              onPointerEnter={() => window.clearTimeout(closeTimer.current)}
              onPointerLeave={() => { if (!pinned) scheduleClose() }}
              onBlur={(e) => {
                if (wrapRef.current?.contains(e.relatedTarget as Node)) return
                setFocusedIndex(null)
                if (!pinned) scheduleClose()
              }}
            >
              <div className="globe-panel-head label">
                <span>{current.name}</span>
                <span>{current.count} mention{current.count === 1 ? '' : 's'}</span>
              </div>
              {current.stories.length > 0 ? (
                <ul>
                  {current.stories.map((s) => (
                    <li key={s.anchorId}>
                      <button type="button" onClick={() => select(s.anchorId)}>
                        <span className="gp-title">{s.title}</span>
                        <span className="gp-meta mono">
                          {formatTime(s.timestamp, timeZone)}
                          {s.sources.length > 0 && ` · ${s.sources.slice(0, 3).map((x) => x.outlet).join(', ')}`}
                          {s.sources.length > 3 && ` +${s.sources.length - 3}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gp-none">Tagged in this briefing's regions without a linked story.</p>
              )}
              {pinned && <p className="gp-hint label">Pinned · Esc to close</p>}
            </div>
          )}
          <div className="visually-hidden">
            <h3>Regions on the globe</h3>
            {regions.length === 0 ? (
              <p>No mapped regions in this briefing.</p>
            ) : (
              <ul>
                {regions.map((r) => (
                  <li key={pointKey(r)}>
                    {r.name}, {r.count} mention{r.count === 1 ? '' : 's'}
                    {zoomable && r.stories.length > 0 && (
                      <> <button type="button" tabIndex={-1} onClick={() => focusPoint(r)}>Show stories in {r.name}</button></>
                    )}
                    <ul>
                      {r.stories.map((s) => (
                        <li key={s.anchorId}><button type="button" tabIndex={-1} onClick={() => select(s.anchorId)}>{s.title}</button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
