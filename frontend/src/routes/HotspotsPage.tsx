import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import { fetchSnapshot, isPartial, isStale, readCachedSnapshot, type HotspotCountry, type HotspotSnapshot } from '../hotspots/data'
import { Flag } from '../hotspots/Flag'
import { GRIDS, type GridDensity } from '../hotspots/grid'
import { HotspotCard, type HotspotCardProps } from '../hotspots/HotspotCard'
import { HotspotsMap } from '../hotspots/HotspotsMap'
import { arcPoints, placeCard, type Box, type Pt } from '../hotspots/layout'
import { Legend } from '../hotspots/Legend'
import { Overlay } from '../hotspots/Overlay'
import { TopCountries } from '../hotspots/TopCountries'
import '../hotspots/hotspots.css'
import { formatTime } from '../lib/time'
import { useMediaQuery, usePrefersReducedMotion } from '../lib/useMediaQuery'
import { useAppState } from '../state/hooks'

type Status = 'loading' | 'ready' | 'failed'
interface MapLayout { scale: number; width: number; height: number }

const DESKTOP_QUERY = '(min-width: 820px)'
/** Px per cell until the map reports its size (HotspotsMap's own default). */
const DEFAULT_SCALE = 8
/** The lifted country rises 12px, so its point, leader and arcs start there. */
const LIFT_PX = 12
/** Keep the card this far inside the map's edges. */
const INSET = 12
const CARD_W = 288
/** A first guess at the card's height; the real one is measured once it renders. */
const CARD_H_GUESS = 392
/** Desktop map box minimum height (matches .hs-stage.is-desktop .hs-mapbox in hotspots.css), so the card fits beside a short map. */
const MAPBOX_MIN_H = 460
/** On a touch screen the map sends a leave right after a tap; the quiet tooltip stays this long. */
const TIP_HOLD_MS = 2000

const DESKS = [
  'BBC World', 'Al Jazeera', 'The Guardian World', 'NPR World', 'The Hindu', 'Deutsche Welle', 'France 24',
  'AllAfrica', 'Straits Times', 'CNN World', 'Fox News World', 'New York Times World', 'ABC News International',
  'CBS News World',
]

const articles = (n: number) => `${n} article${n === 1 ? '' : 's'}`

function cellBounds(cells: number[], cols: number, s: number): Box {
  let c0 = Infinity
  let c1 = -Infinity
  let r0 = Infinity
  let r1 = -Infinity
  for (const i of cells) {
    const c = i % cols
    const r = Math.floor(i / cols)
    c0 = Math.min(c0, c)
    c1 = Math.max(c1, c)
    r0 = Math.min(r0, r)
    r1 = Math.max(r1, r)
  }
  return { x: c0 * s, y: r0 * s, w: (c1 - c0 + 1) * s, h: (r1 - r0 + 1) * s }
}

function HowCounted({ hours }: { hours: number }) {
  return (
    <section className="hs-how" aria-labelledby="hs-how-h">
      <h2 id="hs-how-h" className="label label-mark">How this is counted</h2>
      <p>
        An article names a country when its headline or summary mentions it by name, by a common short form (US, UK),
        by its people (Ukrainian) or by its capital (Kyiv). Each article counts once for every country it names, however
        often it names it. Nothing is counted by a model.
      </p>
      <p>
        The window is the last 24 hours by publish time.{' '}
        {hours < 24
          ? `Right now the feeds reach back about ${hours} hours, so the counts cover the last ${hours} hours.`
          : 'Some feeds hold less than a day of stories; when the counts cover less, the page says how many hours they reach.'}
      </p>
      <p>Articles come from {DESKS.length} world news desks: {DESKS.join(', ')}.</p>
      <p>Each card shows the most widely covered article about the country, with its headline and first sentence in the outlet's own words.</p>
    </section>
  )
}

export function HotspotsPage() {
  const { settings } = useAppState()
  const tz = settings.timeZone
  const navigate = useNavigate()
  const desktop = useMediaQuery(DESKTOP_QUERY)
  const reduced = usePrefersReducedMotion()
  const density: GridDensity = desktop ? 'desktop' : 'mobile'
  const grid = GRIDS[density]

  const [snapshot, setSnapshot] = useState<HotspotSnapshot | null>(() => readCachedSnapshot())
  const [status, setStatus] = useState<Status>('loading')
  // Countries are keyed by ISO2: some (Kosovo) have no ISO numeric code.
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)
  const [layout, setLayout] = useState<MapLayout | null>(null)
  const [tip, setTip] = useState<{ iso2: string; at: Pt } | null>(null)
  const [cardH, setCardH] = useState(CARD_H_GUESS)
  const pinOrigin = useRef<HTMLElement | null>(null)
  const mapboxRef = useRef<HTMLDivElement>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Fetching: on open, on Retry, and when the tab comes back to a stale snapshot. No polling.
  const ctlRef = useRef<AbortController | null>(null)
  const load = useCallback(() => {
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    setStatus('loading')
    fetchSnapshot(ctl.signal).then(
      (s) => {
        if (ctl.signal.aborted) return
        setSnapshot(s)
        setStatus('ready')
      },
      () => {
        if (!ctl.signal.aborted) setStatus('failed')
      },
    )
  }, [])
  useEffect(() => {
    load()
    return () => ctlRef.current?.abort()
  }, [load])

  const latest = useRef({ snapshot, status })
  useEffect(() => {
    latest.current = { snapshot, status }
  })
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return
      const { snapshot: s, status: st } = latest.current
      if (st !== 'loading' && (!s || isStale(s, new Date()))) load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  useEffect(() => () => clearTimeout(tipTimer.current), [])

  const byIso2 = useMemo<Record<string, HotspotCountry>>(
    () => Object.fromEntries((snapshot?.countries ?? []).map((c) => [c.iso2, c])),
    [snapshot],
  )
  const byNumeric = useMemo(
    () => new Map((snapshot?.countries ?? []).filter((c) => c.isoNumeric).map((c) => [c.isoNumeric, c])),
    [snapshot],
  )

  // Hover and focus preview only on desktop; a pinned card wins over both.
  const activeIso2 = pinned ?? (desktop ? hovered : null)
  const active = activeIso2 ? byIso2[activeIso2] : undefined
  const isPinned = !!pinned && !!active

  // A new active country restarts the overlay's sequence.
  const [seq, setSeq] = useState({ iso2: null as string | null, n: 0 })
  if (seq.iso2 !== (active?.iso2 ?? null)) setSeq({ iso2: active?.iso2 ?? null, n: seq.n + 1 })

  const pin = (iso2: string, origin: HTMLElement | null) => {
    pinOrigin.current = origin
    setPinned(iso2)
  }
  const unpin = () => {
    setPinned(null)
    pinOrigin.current?.focus()
    pinOrigin.current = null
  }

  const onMapHover = (iso: string | null) => {
    if (!desktop) return
    setHovered(iso ? (byNumeric.get(iso)?.iso2 ?? null) : null)
  }
  const onMapSelect = (iso: string) => {
    const c = byNumeric.get(iso)
    if (c) pin(c.iso2, mapboxRef.current)
  }
  const onQuietHover = (iso: string | null, at: Pt | null) => {
    const c = iso ? byNumeric.get(iso) : undefined
    if (!desktop) {
      // Touch: a tap shows the tooltip, which then holds; the leave that follows is ignored.
      if (!c || !at) return
      clearTimeout(tipTimer.current)
      setTip({ iso2: c.iso2, at })
      tipTimer.current = setTimeout(() => setTip(null), TIP_HOLD_MS)
      return
    }
    setTip(c && at ? { iso2: c.iso2, at } : null)
  }
  const onMapClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as Element
    if (t.closest('.hs-card, .hs-legend, .hs-mapmsg')) return
    if (t.closest('.hs-hits path:not(.quiet)')) return
    if (pinned) setPinned(null)
  }

  // Card placement and the overlay, in map pixels.
  const s = layout?.scale ?? DEFAULT_SCALE
  const mapW = layout?.width ?? grid.cols * s
  const mapH = layout?.height ?? grid.rows * s
  const cells = active?.isoNumeric ? grid.cells[active.isoNumeric] : undefined
  const anchorCell = active?.isoNumeric ? grid.anchors[active.isoNumeric] : undefined

  let placement: HotspotCardProps['placement'] = desktop ? 'docked' : 'sheet'
  let anchor: Pt | null = null
  let ends: Pt[] = []
  if (active && cells?.length && anchorCell) {
    const from: Pt = [anchorCell[0] * s, anchorCell[1] * s - LIFT_PX]
    anchor = from
    ends = active.with
      .map((iso2) => byIso2[iso2])
      .map((c) => (c?.isoNumeric ? grid.anchors[c.isoNumeric] : undefined))
      .filter((a): a is [number, number] => !!a)
      .map(([x, y]) => [x * s, y * s] as Pt)
    if (desktop) {
      const avoid = (snapshot?.countries ?? [])
        .filter((c) => c.iso2 !== active.iso2 && c.tier !== 'quiet' && c.isoNumeric && grid.anchors[c.isoNumeric])
        .map((c) => {
          const [x, y] = grid.anchors[c.isoNumeric]
          return [x * s, y * s] as Pt
        })
      placement = placeCard({
        anchor: from,
        bounds: cellBounds(cells, grid.cols, s),
        card: { w: CARD_W, h: cardH },
        area: { x: INSET, y: INSET, w: mapW - 2 * INSET, h: Math.max(mapH, MAPBOX_MIN_H) - 2 * INSET },
        avoid,
        arcs: ends.flatMap((e) => arcPoints(from, e)),
      })
    }
  }
  const box = typeof placement === 'object' ? placement.box : null
  const side = typeof placement === 'object' ? placement.side : null

  // Measure the rendered card so placement uses its real height (one extra render per country).
  useLayoutEffect(() => {
    const h = mapboxRef.current?.querySelector<HTMLElement>('.hs-card')?.offsetHeight
    if (h && Math.abs(h - cardH) > 1) setCardH(h)
  }, [active, cardH, desktop])

  const hours = snapshot && snapshot.coverageHours < 24 ? snapshot.coverageHours : 24
  const tipCountry = tip ? byIso2[tip.iso2] : undefined
  const asOf = snapshot ? formatTime(snapshot.generatedAt, tz) : ''
  const statusLine =
    status === 'loading'
      ? `As of ${asOf} · refreshing…`
      : status === 'failed'
        ? `As of ${asOf} · couldn't refresh`
        : `Updated ${asOf} · refreshes hourly`

  const list = (
    <TopCountries
      countries={snapshot?.countries ?? []}
      cutoffs={snapshot?.cutoffs ?? null}
      hours={hours}
      activeIso2={activeIso2}
      onHover={(iso2) => setHovered(iso2)}
      onPin={(iso2, row) => pin(iso2, row)}
      collapsible={desktop}
      open={desktop ? panelOpen : true}
      onToggle={() => setPanelOpen((o) => !o)}
      loading={!snapshot}
    />
  )

  return (
    <div className={`page wrap hs-page${reduced ? ' is-reduced' : ''}`}>
      <header className="hs-head">
        <div className="hs-head-text">
          <p className="hs-eyebrow label label-mark">Hotspots · last {hours} hours</p>
          <h1 className="page-title">Where the news is now</h1>
          <p className="page-lede">
            Countries shaded by how many of today's articles mention them. {desktop ? 'Hover' : 'Tap'} one to see what's driving it.
          </p>
        </div>
        {snapshot && (
          <div className="hs-meta">
            <p>
              <strong className="mono">{snapshot.totalArticles.toLocaleString('en-US')} articles</strong> from {snapshot.feeds} world news
              {snapshot.feeds === 1 ? ' desk' : ' desks'}
            </p>
            <p className="mono">
              {statusLine}
              {isPartial(snapshot) ? ' · partial coverage' : ''}
              {status === 'failed' && (
                <>
                  {' '}
                  <button type="button" className="hs-retry" onClick={load}>
                    Retry
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </header>

      <div className={`hs-stage is-${density}${desktop && panelOpen ? ' is-open' : ''}`}>
        <div className="hs-mapbox" ref={mapboxRef} tabIndex={-1} onClick={onMapClick}>
          <HotspotsMap
            snapshot={snapshot}
            density={density}
            active={active?.isoNumeric || null}
            reduced={reduced}
            onHover={onMapHover}
            onSelect={onMapSelect}
            onQuietHover={onQuietHover}
            onLayout={setLayout}
          />
          <Overlay anchor={anchor} box={box} side={side} arcs={ends} reduced={reduced} seq={seq.n} />
          {tip && tipCountry && (
            <div className="hs-tip" style={{ left: `${tip.at[0]}px`, top: `${tip.at[1] - 6}px` }} aria-hidden="true">
              <Flag iso2={tipCountry.iso2} />
              {tipCountry.name} <span>· {articles(tipCountry.n)}</span>
            </div>
          )}
          {active && snapshot && (
            <HotspotCard
              key={active.iso2}
              country={active}
              snapshot={snapshot}
              byIso2={byIso2}
              placement={placement}
              pinned={isPinned}
              reduced={reduced}
              timeZone={tz}
              onClose={unpin}
              onBrief={(focus) => navigate('/', { state: { briefFocus: focus } })}
            />
          )}
          {!snapshot && (
            <div className="hs-mapmsg" role="status">
              {status === 'failed' ? (
                <>
                  <p>Hotspots are unavailable right now.</p>
                  <button type="button" className="btn" onClick={load}>
                    Retry
                  </button>
                </>
              ) : (
                <p>Waking the server… this can take up to a minute.</p>
              )}
            </div>
          )}
          {desktop && <Legend snapshot={snapshot} density={density} />}
        </div>
        {desktop && list}
      </div>

      {!desktop && (
        <div className="hs-under">
          <Legend snapshot={snapshot} density={density} />
          {list}
        </div>
      )}

      <HowCounted hours={hours} />
    </div>
  )
}
