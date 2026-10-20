import { useEffect, useState } from 'react'
import { loadTrending } from '../lib/trending'

/** The topic chips under Home's ask box: fixed suggestions until live trending topics arrive. */
export function TopicChips({ fallback, onPick, disabled = false }: {
  fallback: string[]
  onPick: (topic: string) => void
  disabled?: boolean
}) {
  const [trending, setTrending] = useState<string[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    loadTrending(ctrl.signal).then((topics) => { if (!ctrl.signal.aborted) setTrending(topics) })
    return () => ctrl.abort()
  }, [])

  const live = trending.length > 0
  const topics = live ? trending : fallback
  return (
    <div className={`chips ${live ? 'chips-live' : ''}`} role="group" aria-label={live ? 'Trending now' : 'Suggested topics'}>
      {live && <span className="chips-label label" aria-hidden="true">Trending now</span>}
      {topics.map((t) => (
        <button key={t} type="button" className="chip" onClick={() => onPick(t)} disabled={disabled}>
          {t}
        </button>
      ))}
    </div>
  )
}
