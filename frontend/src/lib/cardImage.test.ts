import { describe, expect, it } from 'vitest'
import { cardImages } from './cardImage'
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

describe('cardImages', () => {
  it('puts the outlet image first with outlet credit', () => {
    const [img] = cardImages([src(), src({ outlet: 'BBC', url: 'https://b.bc/1', image_url: 'https://img/1.jpg' })], commons)
    expect(img).toEqual({ src: 'https://img/1.jpg', credit: 'Photo: BBC', by: 'BBC', href: 'https://b.bc/1', filePhoto: false })
  })

  it('falls back to commons with file-photo credit', () => {
    expect(cardImages([src()], commons)).toEqual([{
      src: commons.url,
      credit: 'File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons',
      by: 'Jane Doe, CC BY-SA 4.0, Wikimedia Commons',
      href: commons.page_url,
      filePhoto: true,
    }])
  })

  it('is empty with neither', () => {
    expect(cardImages([src()], null)).toEqual([])
  })

  it('uses image_outlet over outlet when present', () => {
    const [img] = cardImages([src({ image_url: 'https://img/1.jpg', image_outlet: 'AP' })], null)
    expect(img.credit).toBe('Photo: AP')
    expect(img.by).toBe('AP')
  })

  it('lists every distinct outlet photo in citation order, then the Commons photo', () => {
    const list = cardImages([
      src({ image_url: 'https://img/1.jpg' }),
      src({ outlet: 'BBC', url: 'https://b.bc/1', image_url: 'https://img/1.jpg' }),
      src({ outlet: 'AP', url: 'https://ap/1', image_url: 'https://img/2.jpg' }),
    ], commons)
    expect(list.map((i) => i.src)).toEqual(['https://img/1.jpg', 'https://img/2.jpg', commons.url])
    expect(list.map((i) => i.by)).toEqual(['Reuters', 'AP', 'Jane Doe, CC BY-SA 4.0, Wikimedia Commons'])
  })
})
