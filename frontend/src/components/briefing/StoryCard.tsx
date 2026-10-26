import { useMemo, useState } from 'react'
import { cardImages } from '../../lib/cardImage'
import type { ViewDevelopment } from '../../lib/normalize'
import { plural } from '../../lib/plural'
import { formatTime } from '../../lib/time'
import { PriorityMark } from './PriorityMark'
import './cards.css'

// Brand-palette grainy gradients for cards without a usable image (.story-card-grain in cards.css).
// Keyed by development index: stable per story, and no repeats within any five stories.
const GRADIENTS = 5

/** A photo card for one development: its outlet photos, then its Commons file photo; with none left, a grainy gradient. */
export function StoryCard({ dev, index, timeZone, onOpen, variant = 'strip' }: {
  dev: ViewDevelopment
  index: number
  timeZone: string
  onOpen: (anchorId: string) => void
  variant?: 'strip' | 'compact'
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const images = useMemo(() => cardImages(dev.sources, dev.commonsImage), [dev.sources, dev.commonsImage])
  const image = images.find((i) => !failed.has(i.src))
  const where = dev.place?.name ?? dev.regions[0] ?? ''
  return (
    <article className={`story-card story-card-${variant}`}>
      <div className="story-card-media">
        {image
          ? <img
              src={image.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
              onError={() => setFailed((prev) => new Set(prev).add(image.src))}
            />
          : <div className="story-card-grain" data-image-fallback={index % GRADIENTS} aria-hidden="true" />}
        {/* Not a link: the whole card is the open button. The file photo's linked credit is on its timeline card. */}
        {image && (
          <span
            className={`story-card-credit label${image.filePhoto ? ' story-card-credit-file' : ''}`}
            title={image.filePhoto ? image.credit : undefined}
          >
            <span className="story-card-credit-prefix">{image.filePhoto ? 'File photo · ' : 'Photo · '}</span>{image.by}
          </span>
        )}
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
