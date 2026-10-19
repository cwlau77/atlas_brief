import { useCallback, useMemo, useState } from 'react'
import { AlertCallout } from '../components/briefing/AlertCallout'
import { ReadingList } from '../components/briefing/ReadingList'
import { StoryCarousel } from '../components/briefing/StoryCarousel'
import { Timeline } from '../components/briefing/Timeline'
import { TopStories } from '../components/briefing/TopStories'
import '../components/briefing/story.css'
import { Globe } from '../globe/Globe'
import { buildRegionPoints, pointKey, type RegionPoint } from '../globe/regions'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useAppState } from '../state/hooks'
import { useBriefing } from './briefingContext'

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
  // The globe point whose carousel is open; a key that no longer matches (new briefing) reads as closed.
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const focused = regions.find((r) => pointKey(r) === focusedKey) ?? null
  const onFocusPoint = useCallback((point: RegionPoint | null) => setFocusedKey(point ? pointKey(point) : null), [])
  const closeCarousel = useCallback(() => setFocusedKey(null), [])
  const focusedDevs = useMemo(
    () => (focused ? focused.stories.map((s) => Number(s.anchorId.replace('dev-', ''))) : []),
    [focused],
  )

  return (
    <div className="story">
      <div className="story-lead wrap">
        <div className="story-lead-copy">
          <AlertCallout alerts={briefing.alerts} />
        </div>
        <div className="story-globe">
          <Globe
            mode="briefing"
            regions={regions}
            timeZone={settings.timeZone}
            onSelectStory={scrollToStory}
            onFocusPoint={onFocusPoint}
            zoomedTo={focused ? focusedKey : null}
            label={`Globe marking ${regions.length} place${regions.length === 1 ? '' : 's'} from this briefing. Select a point to zoom in and browse its stories.`}
          />
          {focused && (
            <StoryCarousel
              key={focusedKey}
              title={focused.name}
              devIndexes={focusedDevs}
              briefing={briefing}
              timeZone={settings.timeZone}
              onOpen={scrollToStory}
              onClose={closeCarousel}
            />
          )}
        </div>
      </div>
      <TopStories briefing={briefing} timeZone={settings.timeZone} onOpen={scrollToStory} />
      <section className="wrap" aria-labelledby="timeline-h">
        <h2 id="timeline-h" className="section-label label">
          Key developments · {count} event{count === 1 ? '' : 's'}
        </h2>
        <Timeline briefing={briefing} timeZone={settings.timeZone} showContext={settings.showHistoricalContext} reduced={reduced} />
      </section>
      <div className="wrap">
        <ReadingList readings={briefing.readingList} />
      </div>
    </div>
  )
}
