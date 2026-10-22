import { useEffect, useState } from 'react'
import { formatWireTime } from '../lib/time'
import { loadTrending, orderWire, type TrendingItem } from '../lib/trending'

const WIRE_LINES = 5
const REFRESH_MS = 10 * 60_000
const NEW_MS = 1600

type Wire = { items: TrendingItem[]; generatedAt: string | null }

const fold = (topic: string) => topic.toLocaleLowerCase()
const sameTopics = (a: TrendingItem[], b: TrendingItem[]) =>
  a.length === b.length && a.every((item, i) => item.topic === b[i].topic)

/**
 * "On the wire" under Home's ask box: timed newsroom topics, newest first, or the
 * fixed suggestions until they arrive. While the tab is visible it checks every ten
 * minutes; loadTrending only refetches once the session copy has expired.
 */
export function TopicWire({ fallback, onPick, disabled = false, timeZone }: {
  fallback: string[]
  onPick: (topic: string) => void
  disabled?: boolean
  timeZone: string
}) {
  const [wire, setWire] = useState<Wire>({ items: [], generatedAt: null })
  // Casefolded topics that just joined the visible lines.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const ctrl = new AbortController()
    let current: TrendingItem[] = []
    let freshTimer: number | undefined
    const load = () => {
      void loadTrending(ctrl.signal).then((result) => {
        // An empty result is a failure: keep what's showing.
        if (ctrl.signal.aborted || !result.items.length) return
        const next = orderWire(result.items)
        if (sameTopics(current, next)) return
        const prev = current
        current = next
        setWire({ items: next, generatedAt: result.generatedAt })
        // Nothing is new on first load or when the fallback gives way.
        if (!prev.length) return
        const seen = new Set(prev.map((i) => fold(i.topic)))
        const added = next.slice(0, WIRE_LINES).map((i) => fold(i.topic)).filter((t) => !seen.has(t))
        window.clearTimeout(freshTimer)
        setFresh(new Set(added))
        if (added.length) freshTimer = window.setTimeout(() => setFresh(new Set()), NEW_MS)
      })
    }
    const check = () => {
      if (document.visibilityState === 'visible') load()
    }
    load()
    const interval = window.setInterval(check, REFRESH_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      ctrl.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
      window.clearTimeout(freshTimer)
    }
  }, [])

  const live = wire.items.length > 0
  const lines: TrendingItem[] = live
    ? wire.items.slice(0, WIRE_LINES)
    : fallback.map((topic) => ({ topic, publishedAt: null }))
  const updated = live ? formatWireTime(wire.generatedAt, timeZone) : ''
  return (
    <div className={`wire ${live ? 'wire-live' : ''}`}>
      <div className="wire-head">
        {/* The list's aria-label already names the wire. */}
        <span className="wire-label" aria-hidden="true">
          {live && <span className="wire-mark" aria-hidden="true" />}
          {live ? 'On the wire' : 'Suggested'}
        </span>
        {updated && <span className="wire-updated">Updated {updated}</span>}
      </div>
      <ul className="wire-list" aria-label={live ? 'On the wire' : 'Suggested topics'}>
        {lines.map(({ topic, publishedAt }) => {
          const time = formatWireTime(publishedAt, timeZone)
          return (
            <li key={topic}>
              <button
                type="button"
                className={`wire-line ${fresh.has(fold(topic)) ? 'is-new' : ''}`}
                aria-label={time ? `Brief me on ${topic}, ${time}` : `Brief me on ${topic}`}
                onClick={() => onPick(topic)}
                disabled={disabled}
              >
                <span className="wire-time mono">{time}</span>
                <span className="wire-topic">{topic}</span>
                <span className="wire-go" aria-hidden="true">Brief me →</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
