import { useState } from 'react'
import type { CardImage as CardImageData } from '../../lib/cardImage'

/**
 * A story card's picture and its credit. Decorative (the headline carries the meaning),
 * so alt is empty. A picture that fails to load takes its credit with it.
 */
export function CardImage({ image, variant }: { image: CardImageData | null; variant: 'side' | 'top' }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (!image || failedSrc === image.src) return null
  return (
    <figure className={`card-img card-img-${variant}`}>
      <div className="card-img-frame">
        <img src={image.src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(image.src)} />
        {image.filePhoto && <span className="card-img-label label">File photo</span>}
      </div>
      <figcaption className="card-img-credit">
        {image.href
          ? <a href={image.href} target="_blank" rel="noopener noreferrer">{image.credit}</a>
          : image.credit}
      </figcaption>
    </figure>
  )
}
