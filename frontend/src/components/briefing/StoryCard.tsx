import { useState } from 'react'
import type { ViewDevelopment } from '../../lib/normalize'
import { plural } from '../../lib/plural'
import { formatTime } from '../../lib/time'
import { PriorityMark } from './PriorityMark'
import './cards.css'

// Brand-palette grainy gradients for cards without a usable image (.story-card-grain in cards.css).
// Keyed by development index: stable per story, and no repeats within any five stories.
const GRADIENTS = 5

/** A photo card for one development; a missing or failed image shows a grainy gradient instead. */
export function StoryCard({ dev, index, timeZone, onOpen, variant = 'strip' }: {
  dev: ViewDevelopment
  index: number
  timeZone: string
  onOpen: (anchorId: string) => void
  variant?: 'strip' | 'compact'
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const image = dev.leadImage && dev.leadImage !== failedSrc ? dev.leadImage : null
  const imageSource = image ? dev.sources.find((s) => s.image_url === image) : undefined
  const credit = imageSource ? imageSource.image_outlet || imageSource.outlet : undefined
  const where = dev.place?.name ?? dev.regions[0] ?? ''
  return (
    <article className={`story-card story-card-${variant}`}>
      <div className="story-card-media">
        {image
          ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrc(image)} />
          : <div className="story-card-grain" data-image-fallback={index % GRADIENTS} aria-hidden="true" />}
        {credit && <span className="story-card-credit label"><span className="story-card-credit-prefix">Photo · </span>{credit}</span>}
      </div>
      <div className="story-card-body">
        <div className="story-card-meta">
          <PriorityMark priority={dev.priority} />
          <time className="label" dateTime={dev.timestamp}>{formatTime(dev.timestamp, timeZone)}</time>
        </div>
        <h3 className="story-card-title">
          <button type="button" className="story-card-open" onClick={() => onOpen(`dev-${index}`)}>
            {dev.title}
          </button>
        </h3>
        <p className="story-card-foot label">
          {where && <><span className="story-card-place">{where}</span> · </>}
          {plural(dev.sources.length, 'source')}
        </p>
        <span className="story-card-cta" aria-hidden="true">Read in timeline →</span>
      </div>
    </article>
  )
}
