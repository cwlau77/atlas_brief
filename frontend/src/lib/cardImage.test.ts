import { describe, expect, it } from 'vitest'
import { cardImages, photosTaken } from './cardImage'
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

describe('no photo leads two cards', () => {
  const shared = src({ url: 'https://r.eu/shared', image_url: 'https://img/shared.jpg' })
  const own = src({ url: 'https://r.eu/own', image_url: 'https://img/own.jpg' })

  it('moves a taken photo behind the card\'s other photos', () => {
    const srcs = cardImages([shared, own], commons, ['https://img/shared.jpg']).map((i) => i.src)
    expect(srcs).toEqual(['https://img/own.jpg', commons.url, 'https://img/shared.jpg'])
  })

  it('lets the earlier card keep a shared photo and the later one lead with its next', () => {
    const taken = photosTaken([
      { sources: [shared], commonsImage: null },
      { sources: [shared, own], commonsImage: null },
      { sources: [shared], commonsImage: commons },
    ])
    expect(taken).toEqual([[], ['https://img/shared.jpg'], ['https://img/shared.jpg']])
    expect(cardImages([shared], commons, taken[2])[0].src).toBe(commons.url)
  })

  it('keeps a shared photo when the card has nothing else', () => {
    const taken = photosTaken([{ sources: [shared], commonsImage: null }, { sources: [shared], commonsImage: null }])
    expect(cardImages([shared], null, taken[1]).map((i) => i.src)).toEqual(['https://img/shared.jpg'])
  })
})
