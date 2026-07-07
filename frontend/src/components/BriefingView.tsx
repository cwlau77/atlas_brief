import type { SavedBriefing } from '../lib/normalize'
import { formatDate } from '../lib/relativeTime'
import { AnalyticsPanel } from './AnalyticsPanel'
import { Contradictions } from './briefing/Contradictions'
import { KeyDevelopments } from './briefing/KeyDevelopments'
import { PriorityAlerts } from './briefing/PriorityAlerts'
import { ReadingList } from './briefing/ReadingList'
import { Tensions } from './briefing/Tensions'
import { loadSettings } from './ProfilePage'
import './briefing/briefing.css'

export function BriefingView({ briefing }: { briefing: SavedBriefing }) {
  const settings = loadSettings()
  const developments = settings.showHistoricalContext
    ? briefing.keyDevelopments
    : briefing.keyDevelopments.map((d) => ({ ...d, historicalContext: '' }))
  return (
    <div className={`briefing-view ${settings.compactMode ? 'compact' : ''}`}>
      <header className="briefing-masthead">
        <h2 className="briefing-focus">{briefing.area}</h2>
        <p className="briefing-issued mono">
          ISSUED {formatDate(briefing.generatedAt).toUpperCase()} · {briefing.frequency.toUpperCase()} CADENCE
        </p>
      </header>
      <PriorityAlerts alerts={briefing.alerts} />
      <KeyDevelopments developments={developments} />
      <Tensions tensions={briefing.emergingTensions} />
      <Contradictions contradictions={briefing.contradictions} />
      <ReadingList readings={briefing.readingList} />
      <AnalyticsPanel briefing={briefing} />
    </div>
  )
}
