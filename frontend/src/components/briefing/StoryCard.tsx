import { useState } from 'react'
import { devAnchor } from '../../globe/regions'
import type { ViewDevelopment } from '../../lib/normalize'
import { plural } from '../../lib/plural'
import { formatTime } from '../../lib/time'
import { RegionMap } from '../RegionMap'
import { PriorityMark } from './PriorityMark'
import './cards.css'

/** A photo card for one development; a missing or failed image shows the region map instead. */
export function StoryCard({ dev, index, timeZone, onOpen, variant = 'strip' }: {
  dev: ViewDevelopment
  index: number
  timeZone: string
  onOpen: (anchorId: string) => void
  variant?: 'strip' | 'carousel'
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const image = dev.leadImage && dev.leadImage !== failedSrc ? dev.leadImage : null
  const credit = image ? dev.sources.find((s) => s.image_url === image)?.outlet : undefined
  const where = dev.place?.name ?? dev.regions[0] ?? ''
  const anchor = devAnchor({ keyDevelopments: [dev] }, 0)
  return (
    <article className={`story-card story-card-${variant}`}>
      <div className="story-card-media">
        {image
          ? <img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrc(image)} />
          : <RegionMap lat={anchor?.lat ?? NaN} lng={anchor?.lng ?? NaN} label={where} />}
        {credit && <span className="story-card-credit label">Photo · {credit}</span>}
      </div>
      <div className="story-card-body">
        <div className="story-card-meta">
          <PriorityMark priority={dev.priority} />
          <time className="label" dateTime={dev.timestamp}>{formatTime(dev.timestamp, timeZone)}</time>
        </div>
        <h3 className="story-card-title">
          <button type="button" className="story-card-open" onClick={() => onOpen(`dev-${index}`)} data-cursor="link">
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
