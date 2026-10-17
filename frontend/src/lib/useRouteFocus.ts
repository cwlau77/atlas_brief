import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * On navigation: Back/Forward restores the previous scroll position, other
 * navigations start at the top, and focus moves to the new page's heading
 * so screen readers announce it. React Router's ScrollRestoration needs a
 * data router, which this app doesn't use.
 */
export function useRouteFocus(): void {
  const location = useLocation()
  const navType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const first = useRef(true)

  useEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const key = location.key
    const save = () => positions.current.set(key, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      save()
      window.removeEventListener('scroll', save)
    }
  }, [location.key])

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo(0, navType === 'POP' ? positions.current.get(location.key) ?? 0 : 0)
    const heading = document.querySelector<HTMLElement>('main h1, main h2')
    if (heading) {
      heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
  }, [location.key, navType])
}
