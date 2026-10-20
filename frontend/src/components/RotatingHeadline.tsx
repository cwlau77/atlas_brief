import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'

export const ROTATING_TOPICS = [
  'Taiwan.', 'the Sahel.', 'Ukraine.', 'lithium.', 'Gaza.', 'Hormuz.', 'tariffs.', 'the Arctic.', 'the Fed.', 'climate.',
  'Iran.', 'Kashmir.', 'elections.', 'cobalt.', 'NATO.', 'Guyana.', 'Venezuela.', 'data hubs.', 'Sudan.', 'chip bans.',
]
const TOPICS = ROTATING_TOPICS

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
          <span className="rot-word">{TOPICS[0]}</span>
        ) : (
          <>
            {tick > 0 && <span key={`out-${tick}`} className="rot-word out">{TOPICS[prev]}</span>}
            <span key={`in-${tick}`} className="rot-word in">{TOPICS[index]}</span>
          </>
        )}
      </span>
    </h1>
  )
}
