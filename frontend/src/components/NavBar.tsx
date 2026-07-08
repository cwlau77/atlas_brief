import { useEffect, useState } from 'react'
import { CompassIcon } from './icons'
import './navbar.css'

export type Page = 'briefing' | 'saved' | 'profile'

const TABS: { id: Page; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'saved', label: 'Archive' },
  { id: 'profile', label: 'Profile' },
]

function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return `${now.toISOString().slice(11, 16)} UTC`
}

function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

export function NavBar({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  const clock = useUtcClock()
  const scrolled = useScrolled()
  return (
    <header className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <button className="wordmark" onClick={() => onNavigate('briefing')} aria-label="Atlas Brief home">
          <CompassIcon size={22} className="wordmark-icon" />
          <span className="wordmark-text">
            Atlas<em>Brief</em>
          </span>
        </button>
        <nav className="nav-tabs" aria-label="Primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-tab ${page === t.id ? 'active' : ''}`}
              aria-current={page === t.id ? 'page' : undefined}
              onClick={() => onNavigate(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="nav-clock mono" title="Coordinated Universal Time">{clock}</div>
      </div>
    </header>
  )
}
