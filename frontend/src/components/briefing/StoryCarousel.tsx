import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SavedBriefing } from '../../lib/normalize'
import { usePrefersReducedMotion } from '../../lib/useMediaQuery'
import { StoryCard } from './StoryCard'
import './cards.css'

// Comfortably longer than the 220ms slide-out in cards.css.
const EXIT_FALLBACK_MS = 600

function time(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

/**
 * The stories at one globe point, newest first, floating over the zoomed map in
 * a scroll-snap track that centres one card; neighbours shrink and fade.
 * Clicking a faded card centres it, clicking the centred card opens it in the
 * timeline. No looping. It slides up on open; with `closing` it slides down and
 * then calls onExited so the page can unmount it.
 */
export function StoryCarousel({ title, devIndexes, briefing, timeZone, onOpen, onClose, closing = false, onExited }: {
  title: string
  devIndexes: number[]
  briefing: SavedBriefing
  timeZone: string
  onOpen: (anchorId: string) => void
  onClose: () => void
  closing?: boolean
  onExited?: () => void
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
    // Scroll the track only: scrollIntoView would also scroll the page and pull the zooming globe out of view.
    const track = trackRef.current, item = itemRefs.current[next]
    if (track && item) track.scrollTo({ left: item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2, behavior })
  }, [n, reduced])

  // Closing (Back, Esc, an ocean click) unmounts the carousel with focus inside it; hand focus back to the opener.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const section = sectionRef.current
    return () => {
      const active = document.activeElement
      if (opener?.isConnected && (!active || active === document.body || section?.contains(active))) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  // Open on the newest card and take focus so the arrow keys work straight away.
  useEffect(() => {
    centre(0, 'auto')
    sectionRef.current?.focus({ preventScroll: true })
  }, [centre])

  // Wait for the slide-out to finish; under reduced motion there is none to wait for.
  useEffect(() => {
    const section = sectionRef.current
    if (!closing || !section) return
    if (reduced) { onExited?.(); return }
    const done = (e: Event) => { if (e.target === section) onExited?.() }
    section.addEventListener('animationend', done)
    // Fallback if the animation never runs (a hidden tab, print): don't leave a dead carousel behind.
    const fallback = window.setTimeout(() => onExited?.(), EXIT_FALLBACK_MS)
    return () => {
      section.removeEventListener('animationend', done)
      window.clearTimeout(fallback)
    }
  }, [closing, reduced, onExited])

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
    <section
      ref={sectionRef} className={`carousel ${closing ? 'is-closing' : ''}`} aria-label={`Stories in ${title}, ${n}`}
      tabIndex={-1} onKeyDown={onKeyDown} inert={closing}
    >
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
              dev={devs[devIndex]} index={devIndex} timeZone={timeZone} variant="compact"
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
