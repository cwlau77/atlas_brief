import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBriefing } from '../../test/fixtures'
import { StoryCard } from './StoryCard'

const briefing = makeBriefing()

describe('StoryCard', () => {
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

  const render = (index: number, onOpen = vi.fn()) => {
    act(() => root.render(
      <StoryCard dev={briefing.keyDevelopments[index]} index={index} timeZone="UTC" onOpen={onOpen} />,
    ))
    return onOpen
  }

  it('shows the lead image lazily, privately and decoratively, with its outlet credit', () => {
    render(0)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('https://img.r.eu/1.jpg')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img.getAttribute('alt')).toBe('')
    expect(container.querySelector('.story-card-credit')?.textContent).toContain('Reuters')
    expect(container.querySelector('[data-image-fallback]')).toBeNull()
  })

  it('shows the headline, the city or first region, and the source count', () => {
    render(0)
    expect(container.textContent).toContain('Drone strike damages tanker near Bab el-Mandeb')
    expect(container.querySelector('.story-card-place')?.textContent).toBe('Aden')
    expect(container.textContent).toContain('2 sources')
    render(2)
    expect(container.querySelector('.story-card-place')?.textContent).toBe('Egypt')
    expect(container.textContent).toContain('1 source')
  })

  it('opens its development in the timeline', () => {
    const onOpen = render(1)
    act(() => container.querySelector<HTMLButtonElement>('button.story-card-open')!.click())
    expect(onOpen).toHaveBeenCalledWith('dev-1')
  })

  it('credits the outlet the photo came from when it differs from the citation', () => {
    const dev = { ...briefing.keyDevelopments[0] }
    dev.sources = [{ ...dev.sources[0], image_outlet: 'AP' }, ...dev.sources.slice(1)]
    act(() => root.render(<StoryCard dev={dev} index={0} timeZone="UTC" onOpen={() => {}} />))
    expect(container.querySelector('.story-card-credit')?.textContent).toBe('Photo · AP')
  })

  const fallback = () => container.querySelector<HTMLElement>('.story-card-media [data-image-fallback]')

  it('swaps a failed image for the grainy gradient without changing the media box', () => {
    render(0)
    const media = container.querySelector('.story-card-media')!
    const before = media.className
    act(() => { container.querySelector('img')!.dispatchEvent(new Event('error')) })
    expect(container.querySelector('img')).toBeNull()
    expect(fallback()).not.toBeNull()
    expect(fallback()!.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.story-card-media')?.className).toBe(before)
    expect(container.querySelector('.story-card-media')?.textContent).toBe('')
    expect(container.querySelector('.story-card-credit')).toBeNull()
  })

  it('draws a grainy gradient straight away when there is no image, varied per story', () => {
    render(1)
    expect(container.querySelector('img')).toBeNull()
    const one = fallback()!.dataset.imageFallback
    render(2)
    const two = fallback()!.dataset.imageFallback
    expect(one).toMatch(/^\d+$/)
    expect(two).toMatch(/^\d+$/)
    expect(one).not.toBe(two)
  })
})
