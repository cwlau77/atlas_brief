import { Link, NavLink, useLocation } from 'react-router'
import { useAppState } from '../state/hooks'
import { latestBriefingId } from '../state/resolveBriefing'
import { AtlasMark } from './AtlasMark'
import { PlusIcon } from './icons'
import './navbar.css'

const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`

export function NavBar() {
  const { session, saved } = useAppState()
  const { pathname } = useLocation()
  const latest = latestBriefingId(session, saved)
  const onBriefing = pathname.startsWith('/brief/')

  return (
    <header className="nav">
      <div className="nav-inner wrap">
        <Link className="wordmark" to="/" aria-label="Atlas home">
          <AtlasMark className="wordmark-mark" />
          <span className="wordmark-text">atlas</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link
            className={`nav-link ${onBriefing ? 'active' : ''}`}
            to={latest ? `/brief/${latest}` : '/'}
            aria-current={onBriefing ? 'page' : undefined}
          >
            Briefing
          </Link>
          <NavLink className={linkClass} to="/archive">Archive</NavLink>
          <NavLink className={linkClass} to="/settings">Settings</NavLink>
        </nav>
        <Link className="btn btn-primary nav-new" to="/" state={{ focusAsk: true }}>
          <span className="nav-new-text">New brief</span><PlusIcon />
        </Link>
      </div>
    </header>
  )
}
