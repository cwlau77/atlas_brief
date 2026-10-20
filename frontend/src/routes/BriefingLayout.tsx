import { NavLink, Outlet, useParams } from 'react-router'
import { formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import { findBriefing } from '../state/resolveBriefing'
import { plural } from '../lib/plural'
import type { BriefingOutletContext } from './briefingContext'
import { UnsavedBriefing } from './UnsavedBriefing'
import './briefing-layout.css'

const tabClass = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`

export function BriefingLayout() {
  const { id } = useParams()
  const { session, saved, settings } = useAppState()
  const briefing = findBriefing(id, session, saved)
  if (!briefing) return <UnsavedBriefing />

  const context: BriefingOutletContext = { briefing }
  return (
    <div className={`briefing ${settings.compactMode ? 'compact' : ''}`}>
      <header className="masthead wrap">
        <div className="masthead-row">
          <h1 className="masthead-title">{briefing.area}</h1>
          <p className="masthead-meta label">
            Issued {formatDateTime(briefing.generatedAt, settings.timeZone)} · {briefing.frequency} ·{' '}
            {plural(briefing.stats.articles, 'article')} · {plural(briefing.stats.sources, 'source')}
          </p>
        </div>
        <nav className="tabs" aria-label="Briefing sections">
          <NavLink end to={`/brief/${briefing.id}`} className={tabClass}>Story</NavLink>
          <NavLink to={`/brief/${briefing.id}/signals`} className={tabClass}>Signals</NavLink>
        </nav>
      </header>
      <Outlet context={context} />
    </div>
  )
}
