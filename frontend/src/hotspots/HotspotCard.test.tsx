import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HotspotCountry, HotspotSnapshot } from './data'
import { Flag } from './Flag'
import { HotspotCard, type HotspotCardProps } from './HotspotCard'

const UKRAINE: HotspotCountry = {
  iso2: 'UA',
  isoNumeric: '804',
  name: 'Ukraine',
  n: 412,
  tier: 'high',
  hourly: Array.from({ length: 24 }, (_, i) => i),
  with: ['RU', 'PL', 'ZZ'],
  story: {
    headline: 'Drone strikes hit Kyiv power grid',
    blurb: 'Russian drones struck energy sites overnight.',
    url: 'https://example.com/kyiv',
    outlet: 'BBC World',
    publishedAt: '2026-10-27T12:05:00Z',
    image: { url: 'https://example.com/kyiv.jpg', credit: 'Outlet photo · BBC World' },
  },
}
const RUSSIA: HotspotCountry = { ...UKRAINE, iso2: 'RU', isoNumeric: '643', name: 'Russia', n: 336, with: [], story: null }
const POLAND: HotspotCountry = { ...UKRAINE, iso2: 'PL', isoNumeric: '616', name: 'Poland', n: 90, tier: 'elevated', with: [], story: null }

const SNAPSHOT: HotspotSnapshot = {
  generatedAt: '2026-10-27T14:05:00Z',
  coverageHours: 24,
  totalArticles: 2140,
  feeds: 14,
  cutoffs: { active: 32, elevated: 86, high: 171 },
  countries: [UKRAINE, RUSSIA, POLAND],
}
const BY_ISO2 = { UA: UKRAINE, RU: RUSSIA, PL: POLAND }

describe('HotspotCard', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T14:05:00Z'))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  const render = (over: Partial<HotspotCardProps> = {}) => {
    const props: HotspotCardProps = {
      country: UKRAINE,
      snapshot: SNAPSHOT,
      byIso2: BY_ISO2,
      placement: { box: { x: 400, y: 80, w: 288, h: 392 }, side: 'l' },
      pinned: false,
      reduced: true,
      timeZone: 'UTC',
      onClose: vi.fn(),
      onBrief: vi.fn(),
      ...over,
    }
    act(() => root.render(<HotspotCard {...props} />))
    return { props, card: container.querySelector<HTMLElement>('.hs-card')! }
  }

  it('shows the outlet headline, blurb and attribution', () => {
    const { card } = render()
    expect(card.querySelector('h3')?.textContent).toBe('Drone strikes hit Kyiv power grid')
    expect(card.textContent).toContain('Russian drones struck energy sites overnight.')
    const link = card.querySelector<HTMLAnchorElement>('a.hs-card-source')!
    expect(link.href).toBe('https://example.com/kyiv')
    expect(link.textContent).toBe('BBC World · 2h ago')
    expect(card.textContent).toContain('1 of 412 articles naming Ukraine')
    expect(card.querySelector('.hs-card-n')?.textContent).toBe('412')
    expect(card.querySelector('.hs-tier')?.textContent).toBe('High')
    // Often named with: known codes only, with their names and flags
    const withRow = card.querySelector('.hs-card-with')!
    expect(withRow.textContent).toContain('Russia')
    expect(withRow.textContent).toContain('Poland')
    expect(withRow.querySelectorAll('img')).toHaveLength(2)
    const photo = card.querySelector('.hs-card-photo')!
    expect(photo.querySelector('img')?.getAttribute('src')).toBe('https://example.com/kyiv.jpg')
    expect(photo.textContent).toContain('Outlet photo · BBC World')
  })

  it('drops the photo block when there is no image', () => {
    const { card } = render({ country: { ...UKRAINE, story: { ...UKRAINE.story!, image: null } } })
    expect(card.querySelector('.hs-card-photo')).toBeNull()
    expect(card.querySelector('h3')?.textContent).toBe('Drone strikes hit Kyiv power grid')
  })

  it('says "articles in 9 hours" when coverage is 9', () => {
    const { card } = render({ snapshot: { ...SNAPSHOT, coverageHours: 9 } })
    expect(card.textContent).toContain('articles in 9 hours')
    expect(card.querySelector('.hs-spark-cap')?.textContent).toBe('9h agonow')
  })

  it('pinned card is a dialog with a close button and closes on Escape', () => {
    const { card: hover } = render()
    expect(hover.getAttribute('role')).toBeNull()
    expect(hover.querySelector('.hs-card-close')).toBeNull()

    const { card, props } = render({ pinned: true })
    expect(card.getAttribute('role')).toBe('dialog')
    expect(card.getAttribute('aria-modal')).toBe('false')
    expect(card.getAttribute('aria-label')).toBe('Ukraine: Drone strikes hit Kyiv power grid')
    expect(document.activeElement).toBe(card)
    act(() => card.querySelector<HTMLButtonElement>('.hs-card-close')!.click())
    expect(props.onClose).toHaveBeenCalledTimes(1)
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('Brief me on calls onBrief with the story headline', () => {
    const { card, props } = render({ pinned: true })
    const btn = [...card.querySelectorAll('button')].find((b) => b.textContent === 'Brief me on this story →')!
    act(() => btn.click())
    expect(props.onBrief).toHaveBeenCalledWith('Drone strikes hit Kyiv power grid')
  })

  it('country without cells opens a docked card', () => {
    const { card } = render({ placement: 'docked' })
    expect(card.classList.contains('is-docked')).toBe(true)
    expect(card.style.left).toBe('')
    expect(card.style.top).toBe('')
    const { card: placed } = render()
    expect(placed.style.left).toBe('400px')
    expect(placed.style.top).toBe('80px')
    const { card: sheet } = render({ placement: 'sheet', pinned: true })
    expect(sheet.classList.contains('is-sheet')).toBe(true)
  })

  it('counts up from 0 after the card appears, and shows n at once under reduced motion', () => {
    vi.useRealTimers()
    const frames: FrameRequestCallback[] = []
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length })
    try {
      const { card } = render({ reduced: false })
      expect(card.querySelector('.hs-card-n')?.textContent).toBe('0')
      const t0 = performance.now()
      act(() => frames.splice(0).forEach((f) => f(t0)))
      act(() => frames.splice(0).forEach((f) => f(t0 + 780 + 700)))
      expect(card.querySelector('.hs-card-n')?.textContent).toBe('412')
    } finally {
      raf.mockRestore()
    }
  })
})

describe('Flag', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  it('Flag renders an img for a known code and nothing for an unknown one', () => {
    act(() => root.render(<Flag iso2="UA" className="x" />))
    const img = container.querySelector('img')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('src')).toMatch(/ua\.svg/)
    expect(img.classList.contains('hs-flag')).toBe(true)
    expect(img.classList.contains('x')).toBe(true)
    act(() => root.render(<Flag iso2="ZZ" />))
    expect(container.innerHTML).toBe('')
  })
})
