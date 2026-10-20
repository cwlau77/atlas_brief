import { useCallback, useMemo, useState } from 'react'
import { AlertCallout } from '../components/briefing/AlertCallout'
import { ReadingList } from '../components/briefing/ReadingList'
import { TensionIndex } from '../components/briefing/TensionIndex'
import { StoryCarousel } from '../components/briefing/StoryCarousel'
import { Timeline } from '../components/briefing/Timeline'
import { TopStories } from '../components/briefing/TopStories'
import '../components/briefing/story.css'
import { Globe } from '../globe/Globe'
import { buildArcs } from '../globe/arcs'
import { buildRegionPoints, pointKey, type RegionPoint } from '../globe/regions'
import { buildRoutes } from '../lib/routes'
import { buildTensionIndex } from '../lib/tensionIndex'
import { sortNewestFirst } from '../lib/timeline'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useAppState } from '../state/hooks'
import { useIndexHighlight } from '../state/useIndexHighlight'
import { useBriefing } from './briefingContext'

const noop = () => {}

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useAppState()
  const reduced = usePrefersReducedMotion()
  usePrintOnLoad()
  const regions = useMemo(() => buildRegionPoints(briefing), [briefing])
  const scrollToStory = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId)
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    if (el && !el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1')
    }
    el?.focus({ preventScroll: true })
  }, [reduced])
  const count = briefing.keyDevelopments.length
  const noAlerts = briefing.alerts.length === 0
  const highlight = useIndexHighlight()
  const order = useMemo(() => sortNewestFirst(briefing.keyDevelopments), [briefing])
  const indexItems = useMemo(() => buildTensionIndex(briefing, order), [briefing, order])
  const indexOrder = useMemo(() => order.map((e) => e.index), [order])
  const arcs = useMemo(() => buildArcs(briefing, buildRoutes(briefing, order).routes), [briefing, order])
  const { active, preview } = highlight
  const litArcs = useMemo(() => new Set(active ? [active] : []), [active])
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
  const shownDevs = useMemo(
    () => (shown ? shown.stories.map((s) => Number(s.anchorId.replace('dev-', ''))) : []),
    [shown],
  )

  return (
    <div className="story">
      <div className="story-lead wrap">
        <div className="story-lead-copy">
          <AlertCallout alerts={briefing.alerts} />
          {/* No alerts: the top stories fill the column beside the globe instead of leaving it empty. */}
          {noAlerts && <TopStories briefing={briefing} timeZone={settings.timeZone} onOpen={scrollToStory} layout="stack" />}
        </div>
        <div className="story-globe">
          <Globe
            mode="briefing"
            regions={regions}
            timeZone={settings.timeZone}
            onSelectStory={scrollToStory}
            onFocusPoint={onFocusPoint}
            zoomedTo={focused ? focusedKey : null}
            arcs={arcs}
            litArcs={litArcs}
            onArcHover={preview}
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
      {!noAlerts && <TopStories briefing={briefing} timeZone={settings.timeZone} onOpen={scrollToStory} />}
      <section className="wrap" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="section-label label label-mark">
          Key developments · {count} event{count === 1 ? '' : 's'}
        </h2>
        <TensionIndex id="tension-index" items={indexItems} devCount={count} order={indexOrder} highlight={highlight} />
        {/* Globe follow (card hover, focus and region taps) is wired in a later step. */}
        <Timeline
          briefing={briefing} timeZone={settings.timeZone} showContext={settings.showHistoricalContext} reduced={reduced}
          items={indexItems} highlight={highlight} onCardHover={noop} onCardFocus={noop} onTagTap={noop}
        />
      </section>
      <div className="wrap">
        <ReadingList readings={briefing.readingList} />
      </div>
    </div>
  )
}
