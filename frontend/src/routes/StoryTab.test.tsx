import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedBriefing } from '../lib/normalize'
import { AppStateProvider } from '../state/AppState'
import { makeBriefing } from '../test/fixtures'
import { StoryTab } from './StoryTab'

// three.js does not run in jsdom: the globe is a placeholder here.
const globeProps = vi.hoisted(() => ({ follow: null as unknown }))
vi.mock('../globe/Globe', () => ({
  Globe: (p: { follow: unknown }) => {
    globeProps.follow = p.follow
    return <div className="globe-stub" />
  },
}))

describe('StoryTab', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  const show = (briefing: SavedBriefing) => act(() => root.render(
    <MemoryRouter initialEntries={['/brief/b-1']}>
      <AppStateProvider>
        <Routes>
          <Route path="/brief/:id" element={<Outlet context={{ briefing }} />}>
            <Route index element={<StoryTab />} />
          </Route>
        </Routes>
      </AppStateProvider>
    </MemoryRouter>,
  ))

  // The page's top-level section headings, in document order.
  const sectionHeadings = () =>
    [...container.querySelectorAll('#alerts-h, #timeline-h, #top-stories-h, #reading-h')].map((h) => h.id)

  it('renders sections in order: read first, key developments, top stories, reading list', () => {
    show(makeBriefing())
    expect(sectionHeadings()).toEqual(['alerts-h', 'timeline-h', 'top-stories-h', 'reading-h'])
    const kd = container.querySelector('section#key-developments')!
    const left = kd.querySelector('.kd-main')!
    expect(left.querySelector('#tension-index')).not.toBeNull()
    expect(left.querySelector('.timeline')).not.toBeNull()
    // The timeline comes first; the index sits below it in the left column, beside the globe.
    expect(left.querySelector('.timeline')!.compareDocumentPosition(left.querySelector('#tension-index')!))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(kd.querySelector('.kd-globe .globe-stub')).not.toBeNull()
    expect(container.querySelector('.story-lead')).toBeNull()
  })

  it('omits read first when no alerts', () => {
    show(makeBriefing({ alerts: [] }))
    expect(container.querySelector('#alerts-h')).toBeNull()
    expect(container.textContent).not.toContain('No priority alerts')
    expect(sectionHeadings()).toEqual(['timeline-h', 'top-stories-h', 'reading-h'])
  })

  it('index omitted when no tensions or contradictions', () => {
    show(makeBriefing({ emergingTensions: [], contradictions: [] }))
    expect(container.querySelector('#tension-index')).toBeNull()
    expect(container.querySelector('section#key-developments .timeline')).not.toBeNull()
  })

  it('a story jump removes the tabindex it added once the card loses focus', () => {
    const briefing = makeBriefing()
    show(briefing)
    const open = [...container.querySelectorAll<HTMLButtonElement>('.top-stories .story-card-open')]
      .find((b) => b.textContent?.includes(briefing.keyDevelopments[0].title))!
    const card = container.querySelector<HTMLElement>('#dev-0')!
    card.scrollIntoView = () => {}
    act(() => open.click())
    expect(card.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(card)
    act(() => open.focus())
    expect(card.hasAttribute('tabindex')).toBe(false)
  })

  it('a Ties to button in the index jumps to its card', () => {
    show(makeBriefing())
    for (const c of container.querySelectorAll<HTMLElement>('.dev')) c.scrollIntoView = () => {}
    const tie = container.querySelector<HTMLButtonElement>('#tension-index .index-ties button')!
    const target = tie.getAttribute('aria-label')!.replace('Go to development: ', '')
    act(() => tie.click())
    const card = document.activeElement as HTMLElement
    expect(card.matches('article.dev')).toBe(true)
    expect(card.querySelector('.dev-title')!.textContent).toBe(target)
  })

  describe('after a story jump', () => {
    const hover = (el: Element, type: 'mouseover' | 'mousemove') => act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true })) })
    const movePointer = (movementX: number) => act(() => {
      const e = new MouseEvent('pointermove', { bubbles: true })
      Object.defineProperty(e, 'movementX', { value: movementX })
      Object.defineProperty(e, 'movementY', { value: 0 })
      window.dispatchEvent(e)
    })
    const setup = () => {
      vi.useFakeTimers()
      const briefing = makeBriefing()
      show(briefing)
      for (const c of container.querySelectorAll<HTMLElement>('.dev')) c.scrollIntoView = () => {}
      const open = [...container.querySelectorAll<HTMLButtonElement>('.top-stories .story-card-open')]
        .find((b) => b.textContent?.includes(briefing.keyDevelopments[0].title))!
      act(() => open.click())
      return container.querySelector<HTMLElement>('#dev-1')!
    }
    afterEach(() => vi.useRealTimers())

    it('a card scrolled under a still pointer does not take the globe', () => {
      globeProps.follow = null
      const other = setup()
      const after = globeProps.follow
      expect(after).not.toBeNull()
      hover(other, 'mouseover')
      act(() => { vi.advanceTimersByTime(400) })
      expect(globeProps.follow).toEqual(after)
    })

    it('real pointer movement ends the guard, so the card under it registers', () => {
      const other = setup()
      const jumped = globeProps.follow
      hover(other, 'mouseover')
      movePointer(3)
      hover(other, 'mousemove')
      act(() => { vi.advanceTimersByTime(400) })
      expect(globeProps.follow).not.toEqual(jumped)
    })
  })

  describe('region tag tap on a touch screen', () => {
    const tapRegion = (globeTop: number) => {
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: q === '(hover: none)', media: q, addEventListener() {}, removeEventListener() {},
      }))
      show(makeBriefing())
      const globe = container.querySelector<HTMLElement>('.kd-globe')!
      globe.getBoundingClientRect = () => ({ top: globeTop, bottom: globeTop + 400, left: 0, right: 400, width: 400, height: 400, x: 0, y: globeTop, toJSON() {} })
      const scroll = vi.fn()
      globe.scrollIntoView = scroll
      act(() => container.querySelector<HTMLButtonElement>('#dev-0 .tags button')!.click())
      return scroll
    }

    it('brings an offscreen globe into view before it zooms', () => {
      const scroll = tapRegion(window.innerHeight + 600)
      expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
    })

    it('leaves a globe already in view alone', () => {
      const scroll = tapRegion(0)
      expect(scroll).not.toHaveBeenCalled()
    })
  })
})
