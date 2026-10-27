import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCallout } from '../components/briefing/AlertCallout'
import { OutlookSection } from '../components/briefing/OutlookSection'
import { ReadingList } from '../components/briefing/ReadingList'
import { TensionIndex } from '../components/briefing/TensionIndex'
import { StoryCarousel } from '../components/briefing/StoryCarousel'
import { Timeline } from '../components/briefing/Timeline'
import { TopStories } from '../components/briefing/TopStories'
import '../components/briefing/story.css'
import { Globe } from '../globe/Globe'
import { buildArcs } from '../globe/arcs'
import { createFollow, type FollowRequest, type FollowTarget } from '../globe/follow'
import { buildRegionPoints, devFollowPoint, pointKey, type RegionPoint } from '../globe/regions'
import { buildOutlook } from '../lib/outlook'
import { buildRoutes } from '../lib/routes'
import { buildTensionIndex } from '../lib/tensionIndex'
import { sortNewestFirst } from '../lib/timeline'
import { useMediaQuery, usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useAppState } from '../state/hooks'
import { useIndexHighlight } from '../state/useIndexHighlight'
import { useBriefing } from './briefingContext'

const INDEX_ID = 'tension-index'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useAppState()
  const reduced = usePrefersReducedMotion()
  usePrintOnLoad()
  const regions = useMemo(() => buildRegionPoints(briefing), [briefing])
  // A one-off globe request (a region tag, or a jump to a story). Each carries a new seq,
  // so asking for the same card again still counts.
  const [request, setRequest] = useState<FollowRequest>(null)
  const seqRef = useRef(0)
  const requestDev = useCallback((dev: number) => setRequest({ dev, seq: ++seqRef.current }), [])
  // A jump scrolls cards under a pointer that never moved, and browsers report those as
  // hovers. Hold card hover back until the pointer really moves (scroll-made moves carry
  // no movement).
  const jumpGuard = useRef(false)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.movementX !== 0 || e.movementY !== 0) jumpGuard.current = false
    }
    window.addEventListener('pointermove', onMove, true)
    return () => window.removeEventListener('pointermove', onMove, true)
  }, [])
  const scrollToStory = useCallback((anchorId: string) => {
    jumpGuard.current = true
    const m = /^dev-(\d+)$/.exec(anchorId)
    if (m) requestDev(Number(m[1]))
    const el = document.getElementById(anchorId)
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    // The card takes focus for accessibility; drop the tabindex once focus moves on, so a
    // later click on the card's text does not focus it again.
    if (el && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1')
      el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true })
    }
    el?.focus({ preventScroll: true })
  }, [reduced, requestDev])
  const count = briefing.keyDevelopments.length
  const highlight = useIndexHighlight()
  const order = useMemo(() => sortNewestFirst(briefing.keyDevelopments), [briefing])
  const indexItems = useMemo(() => buildTensionIndex(briefing, order), [briefing, order])
  const outlook = useMemo(() => buildOutlook(briefing, order), [briefing, order])
  const arcs = useMemo(() => buildArcs(briefing, buildRoutes(briefing, order).routes), [briefing, order])
  const { active, preview, previewed, pinned } = highlight
  const litArcs = useMemo(() => new Set(active ? [active] : []), [active])
  // Hovering an arc on the globe previews its item, but must not move the globe under the pointer.
  const [arcKey, setArcKey] = useState<string | null>(null)
  const onArcHover = useCallback((key: string | null) => {
    setArcKey(key)
    preview(key)
  }, [preview])
  // The globe point whose carousel is open; a key that no longer matches (new briefing) reads as closed.
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const focused = regions.find((r) => pointKey(r) === focusedKey) ?? null
  // The carousel outlives the zoom by its slide-out: closing zooms out at once, and the
  // carousel unmounts when its exit animation ends.
  const [shownKey, setShownKey] = useState<string | null>(null)
  const shown = regions.find((r) => pointKey(r) === shownKey) ?? null
  const onCarouselExited = useCallback(() => setShownKey(null), [])
  const onFocusPoint = useCallback((point: RegionPoint | null) => {
    const key = point ? pointKey(point) : null
    setFocusedKey(key)
    if (key) setShownKey(key)
  }, [])
  const closeCarousel = useCallback(() => setFocusedKey(null), [])
  // The globe follows the reader: a one-off request on any device, then card hover (after a
  // dwell, not on touch screens) and keyboard focus inside a card, then the previewed and
  // pinned index rows. A pin or preview change, dwelling on another card, or keyboard focus
  // on another card retires the request; hover right after a jump is ignored until the
  // pointer moves. See globe/follow.ts.
  const touch = useMediaQuery('(hover: none)')
  const [hoveredDev, setHoveredDev] = useState<number | null>(null)
  const onCardHover = useCallback((dev: number | null) => {
    if (dev !== null && jumpGuard.current) return
    setHoveredDev(dev)
  }, [])
  const [focusedDev, setFocusedDev] = useState<number | null>(null)
  const [follow, setFollow] = useState<FollowTarget>(null)
  const followRef = useRef<ReturnType<typeof createFollow> | null>(null)
  useEffect(() => {
    const f = createFollow({
      resolve: (dev) => devFollowPoint(briefing, regions, dev),
      // Index rows, then outlook rows: both preview through the same highlight.
      itemDevs: (key) => (indexItems.find((item) => item.key === key)
        ?? [...outlook.trends, ...outlook.implications].find((row) => row.key === key))?.devs ?? [],
      onTarget: setFollow,
    })
    followRef.current = f
    setFollow(null)
    return () => {
      f.dispose()
      followRef.current = null
    }
  }, [briefing, regions, indexItems, outlook])
  const carouselOpen = focused !== null || shown !== null
  const previewItem = previewed !== null && previewed !== arcKey ? previewed : null
  useEffect(() => {
    followRef.current?.update({ hoveredDev, focusedDev, request, previewItem, pinnedItem: pinned, carouselOpen, touch })
  }, [hoveredDev, focusedDev, request, previewItem, pinned, carouselOpen, touch, briefing, regions, indexItems, outlook])
  // Opening a carousel retires the request; follow.ts retires it on the other newer intents.
  useEffect(() => { if (carouselOpen) setRequest(null) }, [carouselOpen])
  // On phones the globe sits above the timeline, usually scrolled away: bring it back into
  // view so the reader sees the zoom their tap asked for.
  const globeRef = useRef<HTMLDivElement>(null)
  const onTagTap = useCallback((dev: number) => {
    const globe = globeRef.current
    if (touch && globe) {
      const r = globe.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= window.innerHeight) {
        globe.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' })
      }
    }
    requestDev(dev)
  }, [touch, reduced, requestDev])
  const shownDevs = useMemo(
    () => (shown ? shown.stories.map((s) => Number(s.anchorId.replace('dev-', ''))) : []),
    [shown],
  )

  return (
    <div className="story">
      <AlertCallout alerts={briefing.alerts} />
      <section id="key-developments" className="kd wrap" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="section-label label label-mark">
          Key developments · {count} event{count === 1 ? '' : 's'}
        </h2>
        <div className="kd-cols">
          <div className="kd-main">
            <Timeline
              briefing={briefing} timeZone={settings.timeZone} showContext={settings.showHistoricalContext} reduced={reduced}
              items={indexItems} highlight={highlight} indexId={INDEX_ID}
              onCardHover={onCardHover} onCardFocus={setFocusedDev} onTagTap={onTagTap}
            />
            {/* After the timeline: what it adds up to, then how its actors connect. */}
            <OutlookSection
              trends={outlook.trends} implications={outlook.implications} timeZone={settings.timeZone}
              preview={highlight.preview} onOpen={scrollToStory}
            />
            <TensionIndex id={INDEX_ID} items={indexItems} highlight={highlight} timeZone={settings.timeZone} onOpen={scrollToStory} />
          </div>
          {/* Beside the timeline at 980px and up, sticky so hover-follow stays in view; above it on narrower screens. */}
          <div className="kd-globe" ref={globeRef}>
            <div className="kd-globe-sticky story-globe">
              <Globe
                mode="briefing"
                regions={regions}
                timeZone={settings.timeZone}
                onSelectStory={scrollToStory}
                onFocusPoint={onFocusPoint}
                zoomedTo={focused ? focusedKey : null}
                arcs={arcs}
                litArcs={litArcs}
                onArcHover={onArcHover}
                follow={carouselOpen ? null : follow}
                label={`Globe marking ${regions.length} place${regions.length === 1 ? '' : 's'} from this briefing. Select a point to zoom in and browse its stories.`}
              />
              {shown && (
                <StoryCarousel
                  key={shownKey}
                  title={shown.name}
                  devIndexes={shownDevs}
                  briefing={briefing}
                  timeZone={settings.timeZone}
                  onOpen={scrollToStory}
                  onClose={closeCarousel}
                  closing={shownKey !== focusedKey}
                  onExited={onCarouselExited}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      <TopStories briefing={briefing} timeZone={settings.timeZone} onOpen={scrollToStory} />
      <div className="wrap">
        <ReadingList readings={briefing.readingList} />
      </div>
    </div>
  )
}
