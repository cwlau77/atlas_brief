import { useCallback, useMemo } from 'react'
import { AlertCallout } from '../components/briefing/AlertCallout'
import { ReadingList } from '../components/briefing/ReadingList'
import { Timeline } from '../components/briefing/Timeline'
import '../components/briefing/story.css'
import { Globe } from '../globe/Globe'
import { buildRegionPoints } from '../globe/regions'
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
            label={`Globe marking ${regions.length} region${regions.length === 1 ? '' : 's'} from this briefing. Hover or focus a point to see its stories.`}
          />
        </div>
      </div>
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
