import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { relativeTime } from '../lib/relativeTime'
import type { HotspotCountry, HotspotSnapshot, HotspotStory } from './data'
import { Flag } from './Flag'
import { heatColour, heatT, TIER_LABEL } from './heat'
import { sparklinePath, type Box, type Side } from './layout'

export interface HotspotCardProps {
  country: HotspotCountry
  snapshot: HotspotSnapshot
  byIso2: Record<string, HotspotCountry>
  /** 'docked' = top-left of the map (a country with no cells); 'sheet' = mobile bottom sheet. */
  placement: { box: Box; side: Side } | 'docked' | 'sheet'
  pinned: boolean
  /** Leave out the photo so the card fits beside a short map. */
  compact?: boolean
  reduced: boolean
  timeZone: string
  onClose(): void
  onBrief(focus: string): void
}

/** When the card appears after hover starts, on the leader's sequence (Overlay.tsx). */
const CARD_DELAY_MS = 780
const COUNT_MS = 700
const SPARK_W = 140
const SPARK_H = 38

/** Where the card slides in from: 12px out on the leader's side. */
const SLIDE: Record<Side | 'docked' | 'sheet', [number, number]> = {
  l: [-12, 0],
  r: [12, 0],
  t: [0, -12],
  b: [0, 12],
  docked: [0, -12],
  sheet: [0, 12],
}

function CountUp({ n, delay, reduced }: { n: number; delay: number; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? n : 0)
  useEffect(() => {
    if (reduced) {
      setShown(n)
      return
    }
    let start: number | null = null
    let frame = 0
    const step = (now: number) => {
      start ??= now
      const p = Math.min(1, Math.max(0, (now - start - delay) / COUNT_MS))
      setShown(Math.round(n * (1 - (1 - p) ** 3)))
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [n, delay, reduced])
  return <span className="hs-card-n mono">{shown}</span>
}

function Photo({ image }: { image: NonNullable<HotspotStory['image']> }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className="hs-card-photo">
      <img src={image.url} alt="" onError={() => setFailed(true)} />
      <span>{image.credit}</span>
    </div>
  )
}

function Sparkline({ values, colour }: { values: number[]; colour: string }) {
  const { line, area, last } = sparklinePath(values, SPARK_W, SPARK_H)
  return (
    <svg className="hs-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
      <path className="hs-spark-area" d={area} />
      <path className="hs-spark-line" d={line} />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={colour} />
    </svg>
  )
}

export function HotspotCard(p: HotspotCardProps) {
  const { country, snapshot, byIso2, placement, pinned, compact, reduced, onClose, onBrief } = p
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!pinned) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // iso2: the root is keyed by country, so pinning another one mounts a new node to focus.
  }, [pinned, country.iso2])

  const { story } = country
  const hours = snapshot.coverageHours
  const nMax = Math.max(0, ...snapshot.countries.map((c) => c.n))
  const colour = heatColour(heatT(country.n, snapshot.cutoffs, nMax))
  const placed = typeof placement === 'object'
  const mode = placed ? placement.side : placement
  const [fx, fy] = SLIDE[mode]
  const delay = placed ? CARD_DELAY_MS : 0
  const named = country.with.map((iso2) => byIso2[iso2]).filter((c): c is HotspotCountry => !!c)
  const focus = story?.headline ?? country.name

  const style = {
    '--hs-fx': `${fx}px`,
    '--hs-fy': `${fy}px`,
    '--hs-delay': `${delay}ms`,
    ...(placed ? { left: `${placement.box.x}px`, top: `${placement.box.y}px` } : {}),
  } as CSSProperties

  const cls = ['hs-card', placed ? '' : `is-${placement}`, pinned ? 'is-pinned' : '', reduced ? 'is-reduced' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      key={country.iso2}
      ref={ref}
      className={cls}
      style={style}
      tabIndex={pinned ? -1 : undefined}
      inert={!pinned}
      {...(pinned ? { role: 'dialog', 'aria-modal': false, 'aria-label': `${country.name}: ${focus}` } : {})}
    >
      {story?.image && !compact && <Photo image={story.image} />}
      <div className="hs-card-body">
        <div className="hs-card-head">
          <span className="hs-card-name">
            <Flag iso2={country.iso2} />
            {country.name}
          </span>
          <span className={`label hs-tier is-${country.tier}`} style={{ '--hs-sw': colour } as CSSProperties}>
            {TIER_LABEL[country.tier]}
          </span>
        </div>
        <div className="hs-card-stat">
          <div>
            <CountUp n={country.n} delay={delay} reduced={reduced} />
            <small>articles in {hours} hours</small>
          </div>
          <div>
            <Sparkline values={country.hourly.slice(-hours)} colour={colour} />
            <div className="hs-spark-cap">
              <span>{hours}h ago</span>
              <span>now</span>
            </div>
          </div>
        </div>
        {story && (
          <>
            <h3 className="hs-card-headline">{story.headline}</h3>
            {story.blurb && <p className="hs-card-blurb">{story.blurb}</p>}
            <div className="hs-card-attr">
              <a className="hs-card-source" href={story.url} target="_blank" rel="noopener noreferrer">
                {story.outlet} · {relativeTime(story.publishedAt)}
              </a>
              <div className="mono">
                1 of {country.n} articles naming {country.name}
              </div>
            </div>
          </>
        )}
        {named.length > 0 && (
          <div className="hs-card-with">
            <span className="label">Often named with</span>
            {named.map((c) => (
              <span key={c.iso2} className="hs-card-with-item">
                <Flag iso2={c.iso2} />
                {c.name}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="hs-card-brief" onClick={() => onBrief(focus)}>
          {story ? 'Brief me on this story →' : `Brief me on ${country.name} →`}
        </button>
      </div>
      {pinned && (
        <button type="button" className="hs-card-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}
