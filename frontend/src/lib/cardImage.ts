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

/** `taken` lists photos another card already leads with; they move to the back, shown only when nothing else loads. */
export function cardImages(sources: SourceCitation[], commons: CommonsImage | null, taken: readonly string[] = []): CardImage[] {
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
  if (!taken.length) return out
  return [...out.filter((i) => !taken.includes(i.src)), ...out.filter((i) => taken.includes(i.src))]
}

interface Pictured { sources: SourceCitation[]; commonsImage: CommonsImage | null }

/**
 * Per item, the photos an earlier item already leads with, so no photo leads two cards.
 * Items are claimed in the order given (developments by index, then alerts): each takes
 * its first photo nobody has yet.
 */
export function photosTaken(items: Pictured[]): string[][] {
  const used = new Set<string>()
  return items.map((item) => {
    const srcs = cardImages(item.sources, item.commonsImage).map((i) => i.src)
    const lead = srcs.find((src) => !used.has(src))
    const taken = srcs.filter((src) => used.has(src))
    if (lead) used.add(lead)
    return taken
  })
}
