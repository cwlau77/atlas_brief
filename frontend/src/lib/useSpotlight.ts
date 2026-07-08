import { useCallback } from 'react'
import type { MouseEvent } from 'react'

/**
 * Cursor-tracked spotlight for `.panel.spot` cards: writes the pointer
 * position into CSS custom props consumed by the ::before radial highlight.
 * One mousemove handler, two style writes — no re-renders.
 */
export function useSpotlight() {
  return useCallback((e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }, [])
}
