import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'

const TOPICS = ['the Red Sea.', 'chip controls.', 'the Sahel.', 'climate finance.', 'Taiwan Strait.', 'Black Sea grain.']

export function RotatingHeadline({ intervalMs = 3200 }: { intervalMs?: number }) {
  const reduced = usePrefersReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = window.setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => window.clearInterval(t)
  }, [reduced, intervalMs])
  const index = tick % TOPICS.length
  const prev = (index - 1 + TOPICS.length) % TOPICS.length

  return (
    <h1 className="home-title" aria-label="Brief me on any place or policy">
      <span className="l1" aria-hidden="true">Brief me on</span>
      <span className="rot" aria-hidden="true">
        {reduced ? (
          <span className="rot-word serif">{TOPICS[0]}</span>
        ) : (
          <>
            {tick > 0 && <span key={`out-${tick}`} className="rot-word serif out">{TOPICS[prev]}</span>}
            <span key={`in-${tick}`} className="rot-word serif in">{TOPICS[index]}</span>
          </>
        )}
      </span>
    </h1>
  )
}
