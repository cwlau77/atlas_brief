import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * Focuses an input when the navigation that arrived here carried
 * `state.focusAsk` (the nav's "New brief" link). Runs as a passive effect so
 * it lands after useRouteFocus has moved focus to the page heading, and keys
 * on location.key so clicking New brief while already on Home still works.
 */
export function useFocusOnArrival(inputId: string): void {
  const location = useLocation()
  const focusAsk = (location.state as { focusAsk?: boolean } | null)?.focusAsk === true

  useEffect(() => {
    if (focusAsk) document.getElementById(inputId)?.focus()
  }, [focusAsk, inputId, location.key])
}
