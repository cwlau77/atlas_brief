import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/**
 * On navigation: Back/Forward restores the previous scroll position, other
 * navigations start at the top, and focus moves to the new page's heading
 * so screen readers announce it (for a lazy route, once its heading renders). React Router's ScrollRestoration needs a
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
      window.removeEventListener('scroll', save)
    }
  }, [location.key])

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const top = navType === 'POP' ? positions.current.get(location.key) ?? 0 : 0
    window.scrollTo({ top, left: 0, behavior: 'instant' })
    if (focusHeading()) return
    // A lazy route has no heading until its chunk loads: focus it when it appears,
    // unless the user has moved focus in the meantime.
    const main = document.querySelector('main')
    if (!main) return
    const from = document.activeElement
    const observer = new MutationObserver(() => {
      const moved = document.activeElement !== from && document.activeElement !== document.body
      if (moved || focusHeading()) observer.disconnect()
    })
    observer.observe(main, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [location.key, navType])
}

function focusHeading(): boolean {
  const heading = document.querySelector<HTMLElement>('main h1, main h2')
  if (!heading) return false
  heading.setAttribute('tabindex', '-1')
  heading.focus({ preventScroll: true })
  return true
}
