import type { CSSProperties } from 'react'
import type { Route } from '../../lib/routes'
import { usePrefersReducedMotion } from '../../lib/useMediaQuery'

/** A route's line sample: a short stroke and a stop ring in its colour, dashed for disagreements. */
export function RouteSwatch({ route }: { route: Pick<Route, 'color' | 'dashed'> }) {
  return (
    <svg className="route-swatch" viewBox="0 0 22 10" aria-hidden="true" focusable="false" style={{ '--route': `var(${route.color.token})` } as CSSProperties}>
      <line x1="1" y1="5" x2="21" y2="5" strokeDasharray={route.dashed ? '3 2' : undefined} />
      <circle cx="11" cy="5" r="3" />
    </svg>
  )
}

/** The route key above the timeline. Entries light their route; activating one opens it and jumps to its first stop. */
export function RouteKey({ routes, lit, toggle, setHovered }: {
  routes: Route[]
  lit: Set<string>
  toggle: (key: string) => void
  setHovered: (key: string | null) => void
}) {
  const reduced = usePrefersReducedMotion()
  if (!routes.length) return null
  const jump = (r: Route) => {
    toggle(r.key)
    document.getElementById(`dev-${r.stops[0]}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }
  return (
    <div className="route-key" aria-label="Connections between stories">
      <ul>
        {routes.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              className={lit.has(r.key) ? 'lit' : undefined}
              onClick={() => jump(r)}
              onMouseEnter={() => setHovered(r.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(r.key)}
              onBlur={() => setHovered(null)}
              data-cursor="link"
            >
              <RouteSwatch route={r} />
              <span className="label">{r.kind === 'tension' ? 'Tension' : 'Sources disagree'}</span>
              {' · '}
              <span className="route-key-title">{r.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
