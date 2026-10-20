import { useCallback, useMemo, useState } from 'react'

export interface IndexHighlight {
  pinned: string | null
  previewed: string | null
  /** The preview wins over the pin: what the cards, strip and globe arcs light. */
  active: string | null
  /** Pins the key; pinning the pinned key unpins it. */
  pin: (key: string) => void
  preview: (key: string | null) => void
  clear: () => void
}

/** Tension-index highlight: hover or focus previews, click pins. */
export function useIndexHighlight(): IndexHighlight {
  const [pinned, setPinned] = useState<string | null>(null)
  const [previewed, setPreviewed] = useState<string | null>(null)
  const pin = useCallback((key: string) => setPinned((prev) => (prev === key ? null : key)), [])
  const clear = useCallback(() => setPinned(null), [])
  return useMemo(
    () => ({ pinned, previewed, active: previewed ?? pinned, pin, preview: setPreviewed, clear }),
    [pinned, previewed, pin, clear],
  )
}
