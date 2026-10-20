import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CardImage as CardImageData } from '../../lib/cardImage'
import { CardImage } from './CardImage'

const OUTLET: CardImageData = { src: 'https://img.r.eu/1.jpg', credit: 'Photo: Reuters', href: 'https://r.eu/1', filePhoto: false }
const COMMONS: CardImageData = {
  src: 'https://upload.wikimedia.org/a.jpg',
  credit: 'File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons',
  href: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  filePhoto: true,
}

describe('CardImage', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })
  const render = (image: CardImageData | null, variant: 'side' | 'top' = 'side') =>
    act(() => root.render(<CardImage image={image} variant={variant} />))

  it('renders nothing for null', () => {
    render(null)
    expect(container.innerHTML).toBe('')
  })

  it('renders a lazy decorative image with a linked credit', () => {
    render(OUTLET, 'top')
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe(OUTLET.src)
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.getAttribute('alt')).toBe('')
    expect(container.querySelector('.card-img')!.classList.contains('card-img-top')).toBe(true)
    const a = container.querySelector('a')!
    expect(a.textContent).toBe('Photo: Reuters')
    expect(a.getAttribute('href')).toBe(OUTLET.href)
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders a plain credit without a link when there is no href', () => {
    render({ ...OUTLET, href: null })
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('.card-img-credit')!.textContent).toBe('Photo: Reuters')
  })

  it('CardImage hides on error', () => {
    render(OUTLET)
    act(() => { container.querySelector('img')!.dispatchEvent(new Event('error')) })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.card-img-credit')).toBeNull()
    // A different picture gets its own chance.
    render(COMMONS)
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('CardImage shows File photo label only for commons', () => {
    render(OUTLET)
    expect(container.textContent).not.toContain('File photo')
    render(COMMONS)
    expect(container.querySelector('.card-img-label')!.textContent).toBe('File photo')
  })
})
