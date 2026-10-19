import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { usePrefersReducedMotion } from '../../lib/useMediaQuery'
import { StoryCard } from './StoryCard'
import './cards.css'

function time(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

/**
 * The stories at one globe point, newest first, in a scroll-snap track that
 * centres one card; neighbours shrink and fade. Clicking a faded card centres
 * it, clicking the centred card opens it in the timeline. No looping.
 */
export function StoryCarousel({ title, devIndexes, briefing, timeZone, onOpen, onClose }: {
  title: string
  devIndexes: number[]
  briefing: SavedBriefing
  timeZone: string
  onOpen: (anchorId: string) => void
  onClose: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const devs = briefing.keyDevelopments
  const order = useMemo(
    () => devIndexes.filter((i) => devs[i]).sort((a, b) => time(devs[b].timestamp) - time(devs[a].timestamp) || a - b),
    [devIndexes, devs],
  )
  const [current, setCurrent] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const n = order.length

  const centre = useCallback((i: number, behavior: ScrollBehavior = reduced ? 'auto' : 'smooth') => {
    const next = Math.max(0, Math.min(n - 1, i))
    setCurrent(next)
    itemRefs.current[next]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior })
  }, [n, reduced])

  // Open on the newest card, bring the carousel into view, and take focus so the arrow keys work straight away.
  useEffect(() => {
    centre(0, 'auto')
    sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    sectionRef.current?.focus({ preventScroll: true })
  }, [centre, reduced])

  // Swipes and trackpad scrolls move the centred card; follow it.
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const i = itemRefs.current.indexOf(entry.target as HTMLLIElement)
        if (i >= 0) setCurrent(i)
      }
    }, { root: track, rootMargin: '0px -45% 0px -45%' })
    itemRefs.current.slice(0, n).forEach((el) => { if (el) io.observe(el) })
    return () => io.disconnect()
  }, [n])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); centre(current + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); centre(current - 1) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <section ref={sectionRef} className="carousel" aria-label={`Stories in ${title}, ${n}`} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="carousel-head">
        <button type="button" className="carousel-back label" onClick={onClose} data-cursor="link">← Back to world</button>
        <div className="carousel-arrows">
          <button type="button" aria-label="Previous story" disabled={current <= 0} onClick={() => centre(current - 1)} data-cursor="link">‹</button>
          <button type="button" aria-label="Next story" disabled={current >= n - 1} onClick={() => centre(current + 1)} data-cursor="link">›</button>
        </div>
      </div>
      {n === 0 && <p className="carousel-empty">Tagged in this briefing's regions without a linked story.</p>}
      <ul className="carousel-track" ref={trackRef}>
        {order.map((devIndex, i) => (
          <li key={devIndex} ref={(el) => { itemRefs.current[i] = el }} aria-current={i === current ? 'true' : undefined}>
            <StoryCard
              dev={devs[devIndex]} index={devIndex} timeZone={timeZone} variant="carousel"
              onOpen={(anchorId) => (i === current ? onOpen(anchorId) : centre(i))}
            />
          </li>
        ))}
      </ul>
      {n > 1 && (
        <div className="carousel-dots">
          {order.map((devIndex, i) => (
            <button
              key={devIndex} type="button" aria-label={`Story ${i + 1} of ${n}`}
              aria-current={i === current ? 'true' : undefined} onClick={() => centre(i)}
            />
          ))}
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">
        {n > 0 && `Story ${current + 1} of ${n}: ${devs[order[current]]?.title ?? ''}`}
      </p>
    </section>
  )
}
