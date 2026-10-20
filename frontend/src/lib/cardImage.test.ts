import { describe, expect, it } from 'vitest'
import { cardImage } from './cardImage'
import type { CommonsImage, SourceCitation } from './types'

const src = (over: Partial<SourceCitation> = {}): SourceCitation =>
  ({ outlet: 'Reuters', url: 'https://r.eu/1', published_at: null, ...over })
const commons: CommonsImage = {
  url: 'https://upload.wikimedia.org/x.jpg',
  page_url: 'https://commons.wikimedia.org/wiki/File:X.jpg',
  author: 'Jane Doe',
  license: 'CC BY-SA 4.0',
  source: 'commons',
}

describe('cardImage', () => {
  it('prefers outlet image with outlet credit', () => {
    const img = cardImage([src(), src({ outlet: 'BBC', url: 'https://b.bc/1', image_url: 'https://img/1.jpg' })], commons)
    expect(img).toEqual({ src: 'https://img/1.jpg', credit: 'Photo: BBC', href: 'https://b.bc/1', filePhoto: false })
  })

  it('falls back to commons with file-photo credit', () => {
    expect(cardImage([src()], commons)).toEqual({
      src: commons.url,
      credit: 'File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons',
      href: commons.page_url,
      filePhoto: true,
    })
  })

  it('returns null with neither', () => {
    expect(cardImage([src()], null)).toBeNull()
  })

  it('uses image_outlet over outlet when present', () => {
    const img = cardImage([src({ image_url: 'https://img/1.jpg', image_outlet: 'AP' })], null)
    expect(img?.credit).toBe('Photo: AP')
  })
})
