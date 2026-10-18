import { Link, NavLink, useLocation } from 'react-router'
import { useClock } from '../lib/useClock'
import { useAppState } from '../state/hooks'
import { latestBriefingId } from '../state/resolveBriefing'
import { AtlasMark } from './AtlasMark'
import './navbar.css'

const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`

export function NavBar() {
  const { session, saved, settings } = useAppState()
  const clock = useClock(settings.timeZone, 30_000)
  const { pathname } = useLocation()
  const latest = latestBriefingId(session, saved)
  const onBriefing = pathname.startsWith('/brief/')

  return (
    <header className="nav">
      <div className="nav-inner wrap">
        <Link className="wordmark" to="/" aria-label="Atlas home" data-cursor="link">
          <AtlasMark className="wordmark-mark" />
          <span className="wordmark-text">atlas</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link
            className={`nav-link ${onBriefing ? 'active' : ''}`}
            to={latest ? `/brief/${latest}` : '/'}
            aria-current={onBriefing ? 'page' : undefined}
            data-cursor="link"
          >
            Briefing
          </Link>
          <NavLink className={linkClass} to="/archive" data-cursor="link">Archive</NavLink>
          <NavLink className={linkClass} to="/settings" data-cursor="link">Settings</NavLink>
        </nav>
        <Link className="nav-clock label" to="/settings" title="Change the time zone in Settings" data-cursor="link">
          {clock.time}
        </Link>
      </div>
    </header>
  )
}
