// The pictures a story card can show, best first: each distinct outlet photo in citation
// order, then the Wikimedia Commons file photo. The card falls through them as they fail. Pure.
import type { CommonsImage, SourceCitation } from './types'

export interface CardImage {
  src: string
  credit: string
  /** The credit without its "Photo"/"File photo" prefix. */
  by: string
  href: string | null
  filePhoto: boolean
}

export function cardImages(sources: SourceCitation[], commons: CommonsImage | null): CardImage[] {
  const out: CardImage[] = []
  for (const s of sources) {
    if (!s.image_url || out.some((i) => i.src === s.image_url)) continue
    const by = s.image_outlet ?? s.outlet
    out.push({ src: s.image_url, credit: `Photo: ${by}`, by, href: s.url, filePhoto: false })
  }
  if (commons && !out.some((i) => i.src === commons.url)) {
    const by = `${commons.author}, ${commons.license}, Wikimedia Commons`
    out.push({ src: commons.url, credit: `File photo: ${by}`, by, href: commons.page_url, filePhoto: true })
  }
  return out
}
