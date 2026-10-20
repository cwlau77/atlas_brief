// Picks the picture for a story card: the outlet's own photo when a source has
// one, else a Wikimedia Commons file photo, else nothing. Pure.
import type { CommonsImage, SourceCitation } from './types'

export interface CardImage {
  src: string
  credit: string
  href: string | null
  filePhoto: boolean
}

export function cardImage(sources: SourceCitation[], commons: CommonsImage | null): CardImage | null {
  const withImage = sources.find((s) => s.image_url)
  if (withImage?.image_url) {
    return {
      src: withImage.image_url,
      credit: `Photo: ${withImage.image_outlet ?? withImage.outlet}`,
      href: withImage.url,
      filePhoto: false,
    }
  }
  if (commons) {
    return {
      src: commons.url,
      credit: `File photo: ${commons.author}, ${commons.license}, Wikimedia Commons`,
      href: commons.page_url,
      filePhoto: true,
    }
  }
  return null
}
