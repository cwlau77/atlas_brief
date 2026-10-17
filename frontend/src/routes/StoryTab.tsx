import { useMemo } from 'react'
import { Contradictions } from '../components/briefing/Contradictions'
import { KeyDevelopments } from '../components/briefing/KeyDevelopments'
import { PriorityAlerts } from '../components/briefing/PriorityAlerts'
import { ReadingList } from '../components/briefing/ReadingList'
import { Tensions } from '../components/briefing/Tensions'
import '../components/briefing/briefing.css'
import { GlobeHero } from '../components/GlobeHero'
import { usePrintOnLoad } from '../lib/usePrintOnLoad'
import { useSettings } from '../state/hooks'
import { useBriefing } from './briefingContext'

export function StoryTab() {
  const briefing = useBriefing()
  const { settings } = useSettings()
  usePrintOnLoad()
  const developments = settings.showHistoricalContext
    ? briefing.keyDevelopments
    : briefing.keyDevelopments.map((d) => ({ ...d, historicalContext: '' }))
  const anchors = useMemo(
    () => briefing.keyDevelopments.map((d, i) => ({ headline: d.title, regions: d.regions, anchorId: `dev-${i}` })),
    [briefing],
  )
  return (
    <div className="story wrap">
      <div className="story-globe">
        <GlobeHero regionCounts={briefing.regionCounts} developments={anchors} />
      </div>
      <PriorityAlerts alerts={briefing.alerts} />
      <KeyDevelopments developments={developments} />
      <Tensions tensions={briefing.emergingTensions} />
      <Contradictions contradictions={briefing.contradictions} />
      <ReadingList readings={briefing.readingList} />
    </div>
  )
}
