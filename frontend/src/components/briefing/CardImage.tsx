import { useState } from 'react'
import type { CardImage as CardImageData } from '../../lib/cardImage'

/**
 * A story card's picture and its credit. Decorative (the headline carries the meaning),
 * so alt is empty. A picture that fails to load gives way to the next one, credit and all;
 * when none is left the figure disappears.
 */
export function CardImage({ images, variant }: { images: CardImageData[]; variant: 'side' | 'top' }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const image = images.find((i) => !failed.has(i.src))
  if (!image) return null
  return (
    <figure className={`card-img card-img-${variant}`}>
      <div className="card-img-frame">
        <img
          src={image.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
          onError={() => setFailed((prev) => new Set(prev).add(image.src))}
        />
        {image.filePhoto && <span className="card-img-label label">File photo</span>}
      </div>
      {/* An outlet photo's article is one of the card's source chips, so its credit is for screen readers
          only. A Commons photo's licence and author must stay visible, and linked. */}
      <figcaption className={image.filePhoto ? 'card-img-credit' : 'card-img-credit visually-hidden'}>
        {image.filePhoto && image.href
          ? <a href={image.href} target="_blank" rel="noopener noreferrer">{image.credit}</a>
          : image.credit}
      </figcaption>
    </figure>
  )
}
