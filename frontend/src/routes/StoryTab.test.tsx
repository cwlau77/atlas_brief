import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedBriefing } from '../lib/normalize'
import { AppStateProvider } from '../state/AppState'
import { makeBriefing } from '../test/fixtures'
import { StoryTab } from './StoryTab'

// three.js does not run in jsdom: the globe is a placeholder here.
vi.mock('../globe/Globe', () => ({ Globe: () => <div className="globe-stub" /> }))

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
    // The index sits above the timeline in the left column.
    expect(left.querySelector('#tension-index')!.compareDocumentPosition(left.querySelector('.timeline')!))
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
