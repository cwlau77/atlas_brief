import { NavLink, Outlet, useParams } from 'react-router'
import { AskForm } from '../components/AskForm'
import { formatDateTime } from '../lib/time'
import { useAppState } from '../state/hooks'
import { findBriefing } from '../state/resolveBriefing'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import type { BriefingOutletContext } from './briefingContext'
import { UnsavedBriefing } from './UnsavedBriefing'
import './briefing-layout.css'

const tabClass = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? 'active' : ''}`

export function BriefingLayout() {
  const { id } = useParams()
  const { session, saved, settings } = useAppState()
  const { generate, retry, loading, error } = useGenerateBriefing()
  const briefing = findBriefing(id, session, saved)
  if (!briefing) return <UnsavedBriefing />

  const context: BriefingOutletContext = { briefing }
  return (
    <div className={`briefing ${settings.compactMode ? 'compact' : ''}`}>
      <header className="masthead wrap">
        <div className="masthead-top">
          <p className="masthead-kicker label">Briefing</p>
          <AskForm id="brief-ask" compact loading={loading} error={error} onGenerate={generate} onRetry={retry} placeholder="a new topic" />
        </div>
        <h1 className="masthead-title">{briefing.area}</h1>
        <p className="masthead-meta label">
          Issued {formatDateTime(briefing.generatedAt, settings.timeZone)} · {briefing.frequency} ·{' '}
          {briefing.stats.articles} articles · {briefing.stats.sources} sources
        </p>
        <nav className="tabs" aria-label="Briefing sections">
          <NavLink end to={`/brief/${briefing.id}`} className={tabClass} data-cursor="link">Story</NavLink>
          <NavLink to={`/brief/${briefing.id}/signals`} className={tabClass} data-cursor="link">Signals</NavLink>
        </nav>
      </header>
      <Outlet context={context} />
    </div>
  )
}
