import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBriefing } from '../../test/fixtures'
import { StoryCarousel } from './StoryCarousel'

const briefing = makeBriefing()

describe('StoryCarousel', () => {
  let container: HTMLDivElement
  let root: Root
  // Page scrolls (scrollIntoView) must never happen: the carousel sits over the globe and the zoom must stay in view.
  let scrolled: Element[]
  let trackScrolls: { el: Element; opts: ScrollToOptions }[]
  beforeEach(() => {
    scrolled = []
    trackScrolls = []
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this) })
    Element.prototype.scrollTo = vi.fn(function (this: Element, opts: ScrollToOptions) { trackScrolls.push({ el: this, opts }) }) as never
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    expect(scrolled).toEqual([])
  })

  const render = (devIndexes = [0, 1, 2], closing = false, onExited = vi.fn()) => {
    const onOpen = vi.fn()
    const onClose = vi.fn()
    act(() => root.render(
      <StoryCarousel
        title="Red Sea" devIndexes={devIndexes} briefing={briefing} timeZone="UTC"
        onOpen={onOpen} onClose={onClose} closing={closing} onExited={onExited}
      />,
    ))
    return { onOpen, onClose, onExited }
  }
  const lastTrackScroll = () => trackScrolls.at(-1)
  const section = () => container.querySelector('section')!
  const items = () => [...container.querySelectorAll<HTMLLIElement>('.carousel-track > li')]
  const currentTitle = () => container.querySelector('.carousel-track > li[aria-current="true"] .story-card-open')?.textContent
  const key = (k: string) => act(() => { section().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })
  const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name) || b.getAttribute('aria-label') === name)

  it('is a labelled region listing the stories newest first, opening on the newest', () => {
    render()
    expect(section().getAttribute('aria-label')).toBe('Stories in Red Sea, 3')
    // dev-2 has no source time, so it takes the briefing time (14:32), the newest.
    const titles = items().map((li) => li.querySelector('.story-card-open')?.textContent)
    expect(titles).toEqual([
      briefing.keyDevelopments[2].title, briefing.keyDevelopments[1].title, briefing.keyDevelopments[0].title,
    ])
    expect(items()[0].getAttribute('aria-current')).toBe('true')
    expect(items().filter((li) => li.getAttribute('aria-current') === 'true')).toHaveLength(1)
  })

  it('moves with the arrow keys and does not loop past either end', () => {
    render()
    key('ArrowLeft')
    expect(currentTitle()).toBe(briefing.keyDevelopments[2].title)
    key('ArrowRight')
    expect(currentTitle()).toBe(briefing.keyDevelopments[1].title)
    // Centring scrolls the track only, smoothly, never the page.
    expect(lastTrackScroll()?.el).toBe(container.querySelector('.carousel-track'))
    expect(lastTrackScroll()?.opts.behavior).toBe('smooth')
    key('ArrowRight')
    key('ArrowRight')
    expect(currentTitle()).toBe(briefing.keyDevelopments[0].title)
  })

  it('has named dot buttons that centre their story', () => {
    render()
    const dot = button('Story 3 of 3')!
    expect(dot).toBeDefined()
    act(() => dot.click())
    expect(currentTitle()).toBe(briefing.keyDevelopments[0].title)
    expect(lastTrackScroll()?.el).toBe(container.querySelector('.carousel-track'))
  })

  it('centres a faded card on click and opens only the current one', () => {
    const { onOpen } = render()
    act(() => items()[1].querySelector<HTMLButtonElement>('.story-card-open')!.click())
    expect(onOpen).not.toHaveBeenCalled()
    expect(currentTitle()).toBe(briefing.keyDevelopments[1].title)
    act(() => items()[1].querySelector<HTMLButtonElement>('.story-card-open')!.click())
    expect(onOpen).toHaveBeenCalledWith('dev-1')
  })

  it('closes from Back to world and from Escape', () => {
    const { onClose } = render()
    act(() => button('← Back to world')!.click())
    expect(onClose).toHaveBeenCalledTimes(1)
    key('Escape')
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows a single story with disabled arrows and no dots', () => {
    render([2])
    expect(section().getAttribute('aria-label')).toBe('Stories in Red Sea, 1')
    expect(items()).toHaveLength(1)
    expect(items()[0].getAttribute('aria-current')).toBe('true')
    expect((button('Previous story') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Next story') as HTMLButtonElement).disabled).toBe(true)
    expect(container.querySelector('.carousel-dots')).toBeNull()
  })

  it('says so when the point has no linked stories', () => {
    render([])
    expect(section().getAttribute('aria-label')).toBe('Stories in Red Sea, 0')
    expect(container.querySelector('.carousel-empty')?.textContent).toContain('without a linked story')
    expect((button('Next story') as HTMLButtonElement).disabled).toBe(true)
  })

  it('hands focus back to whatever opened it when it closes', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    render()
    expect(document.activeElement).toBe(section())
    act(() => root.render(<></>))
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('slides in, and slides out before telling the page it can unmount', () => {
    const { onExited } = render()
    expect(section().classList.contains('is-closing')).toBe(false)
    render([0, 1, 2], true, onExited)
    expect(section().classList.contains('is-closing')).toBe(true)
    expect(onExited).not.toHaveBeenCalled()
    act(() => { section().dispatchEvent(new Event('animationend', { bubbles: true })) })
    expect(onExited).toHaveBeenCalledTimes(1)
  })

  it('closes at once under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)', media: query, addEventListener: () => {}, removeEventListener: () => {},
    }))
    const onExited = vi.fn()
    render([0, 1, 2], true, onExited)
    expect(onExited).toHaveBeenCalledTimes(1)
  })
})
