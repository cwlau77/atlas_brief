import { useCallback, useMemo } from 'react'
import { Contradictions } from '../components/briefing/Contradictions'
import { KeyDevelopments } from '../components/briefing/KeyDevelopments'
import { PriorityAlerts } from '../components/briefing/PriorityAlerts'
import { ReadingList } from '../components/briefing/ReadingList'
import { Tensions } from '../components/briefing/Tensions'
import '../components/briefing/briefing.css'
import { Globe } from '../globe/Globe'
import { buildRegionPoints } from '../globe/regions'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useSettings } from '../state/hooks'
import { useBriefing } from './briefingContext'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useSettings()
  const reduced = usePrefersReducedMotion()
  usePrintOnLoad()
  const regions = useMemo(() => buildRegionPoints(briefing), [briefing])
  const scrollToStory = useCallback((anchorId: string) => {
    document.getElementById(anchorId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [reduced])
  const developments = settings.showHistoricalContext
    ? briefing.keyDevelopments
    : briefing.keyDevelopments.map((d) => ({ ...d, historicalContext: '' }))
  return (
    <div className="story wrap">
      <div className="story-globe">
        <Globe
          mode="briefing"
          regions={regions}
          timeZone={settings.timeZone}
          onSelectStory={scrollToStory}
          label={`Globe marking ${regions.length} region${regions.length === 1 ? '' : 's'} from this briefing. Hover or focus a point to see its stories.`}
        />
      </div>
      <PriorityAlerts alerts={briefing.alerts} />
      <KeyDevelopments developments={developments} />
      <Tensions tensions={briefing.emergingTensions} />
      <Contradictions contradictions={briefing.contradictions} />
      <ReadingList readings={briefing.readingList} />
    </div>
  )
}
