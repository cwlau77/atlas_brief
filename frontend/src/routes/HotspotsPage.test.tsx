import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOTSPOTS_CACHE_KEY, normalizeSnapshot } from '../hotspots/data'
import { KEYS } from '../lib/storage'
import { AppStateProvider } from '../state/AppState'
import { HotspotsPage } from './HotspotsPage'

type Wire = Record<string, unknown>

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const wireCountry = (iso2: string, isoNumeric: string, name: string, n: number, tier: string, over: Wire = {}): Wire => ({
  iso2,
  iso_numeric: isoNumeric,
  name,
  n,
  tier,
  hourly: Array.from({ length: 24 }, (_, i) => i % 5),
  with: [],
  story: {
    headline: `${name} headline`,
    blurb: `${name} blurb.`,
    article: { title: `${name} headline`, url: `https://example.com/${iso2}`, outlet: 'BBC World', published_at: '2026-10-27T12:05:00Z' },
    image: null,
  },
  ...over,
})

const wire = (over: Wire = {}): Wire => ({
  generated_at: '2026-10-27T14:05:00Z',
  window_hours: 24,
  coverage_hours: 24,
  total_articles: 2140,
  feeds: 14,
  cutoffs: { active: 32, elevated: 86, high: 171 },
  countries: [
    wireCountry('UA', '804', 'Ukraine', 412, 'high', { with: ['RU'] }),
    wireCountry('RU', '643', 'Russia', 336, 'high'),
    wireCountry('CN', '156', 'China', 298, 'high'),
    wireCountry('SG', '702', 'Singapore', 40, 'active'),
    wireCountry('FR', '250', 'France', 12, 'quiet', { story: null }),
  ],
  ...over,
})

const ok = (body: Wire) => ({ ok: true, status: 200, json: async () => body }) as Response
const unavailable = () => ({ ok: false, status: 503, json: async () => ({}) }) as Response

function cache(body: Wire) {
  window.localStorage.setItem(HOTSPOTS_CACHE_KEY, JSON.stringify(normalizeSnapshot(body)))
}

function stubMedia({ desktop }: { desktop: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(min-width: 820px)' ? desktop : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }))
}

/** A fetch whose reply the test releases. */
function deferredFetch() {
  let release: (r: Response) => void = () => {}
  let fail: (e: Error) => void = () => {}
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((res, rej) => {
        release = res
        fail = rej
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, release: (r: Response) => release(r), fail: (e: Error) => fail(e) }
}

let lastLocation: ReturnType<typeof useLocation> | null = null
function HomeProbe() {
  lastLocation = useLocation()
  return <p>home</p>
}

describe('HotspotsPage', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-10-27T14:20:00Z'))
    window.localStorage.clear()
    window.localStorage.setItem(KEYS.settings, JSON.stringify({ timeZone: 'UTC' }))
    stubMedia({ desktop: true })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/hotspots']}>
          <AppStateProvider>
            <Routes>
              <Route path="/hotspots" element={<HotspotsPage />} />
              <Route path="/" element={<HomeProbe />} />
            </Routes>
          </AppStateProvider>
        </MemoryRouter>,
      ),
    )
  const settle = async () => {
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })
  }
  const meta = () => container.querySelector('.hs-meta')?.textContent ?? ''
  const rows = () => [...container.querySelectorAll<HTMLButtonElement>('.hs-rows button')]
  const row = (name: string) => rows().find((b) => b.getAttribute('aria-label')?.startsWith(`${name},`))!
  const card = () => container.querySelector<HTMLElement>('.hs-card')

  it('renders the cached snapshot immediately, then the fresh one', async () => {
    cache(wire({ total_articles: 900, generated_at: '2026-10-27T13:05:00Z' }))
    const f = deferredFetch()
    render()
    expect(meta()).toContain('900 articles')
    expect(meta()).toContain('As of 13:05 UTC · refreshing…')
    expect(rows()).toHaveLength(5)
    expect(row('Ukraine').getAttribute('aria-label')).toBe('Ukraine, High, 412 articles')

    f.release(ok(wire()))
    await settle()
    expect(meta()).toContain('2,140 articles from 14 world news desks')
    expect(meta()).toContain('Updated 14:05 UTC · refreshes hourly')
    expect(meta()).not.toContain('refreshing')
    expect(f.fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows the skeleton and waking message on a cold start', () => {
    deferredFetch()
    render()
    expect(container.textContent).toContain('Waking the server… this can take up to a minute.')
    expect(container.querySelectorAll('.hs-rows .is-skel')).toHaveLength(8)
    expect(container.querySelector('.hs-base rect.hs-skel')).not.toBeNull()
  })

  it('renders the unavailable state with retry', async () => {
    const fetchMock = vi.fn(async () => unavailable())
    vi.stubGlobal('fetch', fetchMock)
    render()
    await settle()
    expect(container.textContent).toContain('Hotspots are unavailable right now.')
    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Retry')!
    expect(retry).toBeTruthy()
    // The map stays drawn as a skeleton, never blank.
    expect(container.querySelector('.hs-base rect.hs-skel')).not.toBeNull()

    fetchMock.mockImplementation(async () => ok(wire()))
    act(() => retry.click())
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).not.toContain('unavailable')
    expect(rows()).toHaveLength(5)
  })

  it("says couldn't refresh and keeps the cached map when the fetch fails", async () => {
    cache(wire({ generated_at: '2026-10-27T13:05:00Z' }))
    vi.stubGlobal('fetch', vi.fn(async () => unavailable()))
    render()
    await settle()
    expect(meta()).toContain("As of 13:05 UTC · couldn't refresh")
    expect(container.querySelector('.hs-meta button')!.textContent).toBe('Retry')
    expect(container.querySelector('.hs-base rect.hs-skel')).toBeNull()
    expect(rows()).toHaveLength(5)
    expect(container.textContent).not.toContain('unavailable')
  })

  it('flags partial coverage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire({ feeds: 3 }))))
    render()
    await settle()
    expect(meta()).toContain('Updated 14:05 UTC · refreshes hourly · partial coverage')
  })

  it('focusing a row previews and Enter pins the card', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    act(() => row('Ukraine').focus())
    expect(card()!.textContent).toContain('Ukraine headline')
    expect(card()!.getAttribute('role')).toBeNull()
    expect(row('Ukraine').closest('li')!.classList.contains('is-on')).toBe(true)
    // The lift and leader play for a country with cells.
    expect(container.querySelector('.hs-overlay .hs-leader')).not.toBeNull()

    act(() => row('Ukraine').click()) // Enter on a button activates it
    expect(card()!.getAttribute('role')).toBe('dialog')
    expect(document.activeElement).toBe(card())

    // While pinned, previewing another row does nothing.
    act(() => row('Russia').focus())
    expect(card()!.textContent).toContain('Ukraine headline')
  })

  it('Escape unpins and returns focus to the row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    act(() => row('Russia').focus())
    act(() => row('Russia').click())
    expect(card()!.getAttribute('role')).toBe('dialog')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('.hs-card[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(row('Russia'))
  })

  it('clicking empty map unpins', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    act(() => row('Ukraine').click())
    expect(card()!.getAttribute('role')).toBe('dialog')
    act(() => container.querySelector('.hs-backgrid')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('.hs-card[role="dialog"]')).toBeNull()
  })

  it('a country with no cells opens a docked card with no lift or leader', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    act(() => row('Singapore').focus())
    expect(card()!.classList.contains('is-docked')).toBe(true)
    expect(container.querySelector('.hs-overlay .hs-pt')).toBeNull()
    expect(container.querySelector('.hs-overlay .hs-leader')).toBeNull()
    expect(container.querySelector('.hs-lift')).toBeNull()
    act(() => row('Singapore').click())
    expect(card()!.getAttribute('role')).toBe('dialog')
    expect(card()!.classList.contains('is-docked')).toBe(true)
  })

  it('uses the coverage hours in the eyebrow when under 24', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire({ coverage_hours: 6 }))))
    render()
    await settle()
    expect(container.querySelector('.hs-eyebrow')!.textContent).toBe('Hotspots · last 6 hours')
    expect(container.querySelector('.hs-legend h2')!.textContent).toBe('Mentions, last 6 hours')
  })

  it('Brief me on starts a briefing with the headline as the focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    act(() => row('Ukraine').click())
    act(() => container.querySelector<HTMLButtonElement>('.hs-card-brief')!.click())
    expect(container.textContent).toContain('home')
    expect(lastLocation!.state).toEqual({ briefFocus: 'Ukraine headline' })
  })

  it('refetches when the tab becomes visible with a stale snapshot', async () => {
    const fetchMock = vi.fn(async () => ok(wire()))
    vi.stubGlobal('fetch', fetchMock)
    render()
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(1) // 15 minutes old: still fresh
    vi.setSystemTime(new Date('2026-10-27T15:30:00Z'))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await settle()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('desktop: the Top countries panel opens by default and toggles', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
    render()
    await settle()
    const tab = container.querySelector<HTMLButtonElement>('.hs-panel-tab')!
    expect(tab.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.hs-stage')!.classList.contains('is-open')).toBe(true)
    act(() => tab.click())
    expect(tab.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.hs-stage')!.classList.contains('is-open')).toBe(false)
  })

  describe('card fit (desktop)', () => {
    // jsdom has no layout: the map is 132 x 51 cells at 8px (408px, so the desktop box's minimum
    // height applies), the panel tab's bottom edge is put 36px below the map box's top, and the card
    // reports fullH with its photo and COMPACT_H without.
    const TAB_BOTTOM = 36
    const MAP_H = 620
    /** The tallest card measured live (Russia, with photo, long blurb and "Often named with"). */
    const TALLEST_REAL_H = 555
    const COMPACT_H = 380
    const FULL_H = TALLEST_REAL_H
    const withPhoto = (over: Wire = {}) =>
      wire({
        countries: [
          wireCountry('UA', '804', 'Ukraine', 412, 'high', {
            story: {
              headline: 'Ukraine headline',
              blurb: 'Ukraine blurb.',
              article: { title: 'Ukraine headline', url: 'https://example.com/UA', outlet: 'BBC World', published_at: '2026-10-27T12:05:00Z' },
              image: { url: 'https://example.com/ua.jpg', credit: 'BBC World' },
            },
          }),
          wireCountry('RU', '643', 'Russia', 336, 'high'),
          wireCountry('CN', '156', 'China', 298, 'high'),
        ],
        ...over,
      })
    let fullH: number = FULL_H
    beforeEach(() => {
      fullH = FULL_H
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        if (!this.classList.contains('hs-card')) return 0
        return this.querySelector('.hs-card-photo') ? fullH : COMPACT_H
      })
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const bottom = this.classList.contains('hs-panel-tab') ? TAB_BOTTOM : 0
        return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom, width: 0, height: bottom, toJSON() {} } as DOMRect
      })
    })
    afterEach(() => vi.restoreAllMocks())
    const box = () => ({ top: parseFloat(card()!.style.top), h: card()!.offsetHeight })

    it('the desktop map box is tall enough for the tallest real card below the tab', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ok(withPhoto())))
      render()
      await settle()
      const mapbox = container.querySelector<HTMLElement>('.hs-mapbox')!
      expect(mapbox.style.minHeight).toBe(`${MAP_H}px`)
      expect(TAB_BOTTOM + 8 + TALLEST_REAL_H + 12).toBeLessThanOrEqual(MAP_H)
    })

    it('a card of realistic height keeps its photo inside the area', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ok(withPhoto())))
      render()
      await settle()
      act(() => row('Ukraine').focus())
      expect(card()!.querySelector('.hs-card-photo')).not.toBeNull()
      const { top, h } = box()
      expect(top).toBeGreaterThanOrEqual(TAB_BOTTOM + 8)
      expect(top + h).toBeLessThanOrEqual(MAP_H - 12)
    })

    it('an oversized card falls back to compact and stays inside the area', async () => {
      fullH = 700
      vi.stubGlobal('fetch', vi.fn(async () => ok(withPhoto())))
      render()
      await settle()
      act(() => row('Ukraine').focus())
      expect(card()!.querySelector('.hs-card-photo')).toBeNull()
      expect(card()!.textContent).toContain('Ukraine headline')
      const { top, h } = box()
      expect(top).toBeGreaterThanOrEqual(TAB_BOTTOM + 8)
      expect(top + h).toBeLessThanOrEqual(MAP_H - 12)
    })

    it('places the card below the panel tab', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ok(withPhoto())))
      render()
      await settle()
      for (const name of ['Ukraine', 'Russia', 'China']) {
        act(() => row(name).focus())
        expect(box().top, name).toBeGreaterThanOrEqual(TAB_BOTTOM + 8)
      }
    })
  })

  describe('mobile', () => {
    beforeEach(() => stubMedia({ desktop: false }))

    it('has no panel tab, opens a bottom sheet and holds the quiet tooltip for 2s', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ok(wire())))
      render()
      await settle()
      expect(container.querySelector('.hs-panel-tab')).toBeNull()
      expect(container.querySelector('.hs-readout')).toBeNull()

      const hit = (iso: string) => container.querySelector<SVGPathElement>(`.hs-hits path[data-iso="${iso}"]`)!
      // Hover does nothing on a touch screen.
      act(() => hit('804').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })))
      expect(card()).toBeNull()
      act(() => hit('804').dispatchEvent(new MouseEvent('click', { bubbles: true })))
      expect(card()!.classList.contains('is-sheet')).toBe(true)
      expect(container.querySelector('.hs-overlay .hs-leader')).toBeNull()
      act(() => container.querySelector<HTMLButtonElement>('.hs-card-close')!.click())
      expect(card()).toBeNull()

      act(() => hit('250').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })))
      act(() => hit('250').dispatchEvent(new PointerEvent('pointerout', { bubbles: true })))
      expect(container.querySelector('.hs-tip')!.textContent).toContain('France')
      act(() => {
        vi.advanceTimersByTime(2100)
      })
      expect(container.querySelector('.hs-tip')).toBeNull()
    })
  })
})
