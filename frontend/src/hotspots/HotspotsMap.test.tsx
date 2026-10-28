import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HotspotCountry, HotspotSnapshot, Tier } from './data'
import { GRIDS } from './grid'
import { HotspotsMap, type HotspotsMapProps } from './HotspotsMap'

const country = (isoNumeric: string, iso2: string, name: string, n: number, tier: Tier): HotspotCountry => ({
  isoNumeric, iso2, name, n, tier, hourly: [], with: [], story: null,
})

const SNAPSHOT: HotspotSnapshot = {
  generatedAt: '2026-10-27T14:05:00Z',
  coverageHours: 24,
  totalArticles: 2140,
  feeds: 14,
  cutoffs: { active: 32, elevated: 86, high: 171 },
  countries: [
    country('643', 'RU', 'Russia', 336, 'high'),
    country('804', 'UA', 'Ukraine', 412, 'high'),
    country('156', 'CN', 'China', 298, 'high'),
    country('250', 'FR', 'France', 12, 'quiet'),
  ],
}

describe('HotspotsMap', () => {
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

  const render = (over: Partial<HotspotsMapProps> = {}) => {
    const props: HotspotsMapProps = {
      snapshot: SNAPSHOT,
      density: 'desktop',
      active: null,
      reduced: false,
      onHover: vi.fn(),
      onSelect: vi.fn(),
      onQuietHover: vi.fn(),
      onLayout: vi.fn(),
      ...over,
    }
    act(() => root.render(<HotspotsMap {...props} />))
    return props
  }
  const group = (iso: string) => container.querySelector<SVGGElement>(`.hs-base g[data-iso="${iso}"]`)!

  it('draws a cell per grid cell of each country, sized by heat', () => {
    render()
    const rects = [...group('804').querySelectorAll('rect')]
    expect(rects).toHaveLength(GRIDS.desktop.cells['804'].length)
    for (const r of rects) {
      expect(Number(r.getAttribute('width'))).toBeCloseTo(0.88, 5)
      expect(r.getAttribute('fill')).toMatch(/^#[0-9A-F]{6}$/)
    }
    // A country absent from the snapshot is drawn at n = 0: the smallest cell.
    const absent = [...group('036').querySelectorAll('rect')]
    expect(absent).toHaveLength(GRIDS.desktop.cells['036'].length)
    expect(Number(absent[0].getAttribute('width'))).toBeCloseTo(0.5, 5)
    // High countries glow; others don't.
    expect(container.querySelector('.hs-glow path[data-iso="804"]')).not.toBeNull()
    expect(container.querySelector('.hs-glow path[data-iso="250"]')).toBeNull()
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe(`0 0 ${GRIDS.desktop.cols} ${GRIDS.desktop.rows}`)
  })

  it('draws the skeleton when there is no snapshot', () => {
    render({ snapshot: null })
    const rects = [...container.querySelectorAll('.hs-base rect')]
    const total = Object.values(GRIDS.desktop.cells).reduce((s, c) => s + c.length, 0)
    expect(rects).toHaveLength(total)
    expect(rects.every((r) => r.classList.contains('hs-skel') && r.getAttribute('width') === '0.5')).toBe(true)
    expect(container.querySelector('.hs-glow path')).toBeNull()
  })

  it('calls onSelect for a non-quiet country and not for a quiet one', () => {
    const props = render()
    const hit = (iso: string) => container.querySelector<SVGPathElement>(`.hs-hits path[data-iso="${iso}"]`)!
    act(() => hit('804').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(props.onSelect).toHaveBeenCalledWith('804')
    act(() => hit('250').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    act(() => hit('036').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(props.onSelect).toHaveBeenCalledTimes(1)
    expect(hit('250').classList.contains('quiet')).toBe(true)
    expect(hit('804').classList.contains('quiet')).toBe(false)
  })

  it('lifts the active non-quiet country and fades the rest, but not a quiet one', () => {
    render({ active: '804', reduced: true })
    const lift = container.querySelector('.hs-lift')!
    expect(lift.getAttribute('data-iso')).toBe('804')
    expect(lift.classList.contains('up')).toBe(true)
    expect(lift.querySelectorAll('.hs-tile rect')).toHaveLength(GRIDS.desktop.cells['804'].length)
    expect(container.querySelector('svg')!.classList.contains('is-focus')).toBe(true)
    expect(group('804').classList.contains('on')).toBe(true)
    render({ active: '250', reduced: true })
    expect(container.querySelector('.hs-lift')).toBeNull()
    expect(container.querySelector('svg')!.classList.contains('is-focus')).toBe(false)
  })

  it('raises the lift on the next frame and unmounts it 450ms after leaving', () => {
    vi.useFakeTimers()
    try {
      render({ active: '804' })
      const lift = () => container.querySelector('.hs-lift')
      expect(lift()?.classList.contains('up')).toBe(false)
      act(() => vi.advanceTimersByTime(40))
      expect(lift()?.classList.contains('up')).toBe(true)
      render({ active: null })
      expect(lift()?.classList.contains('up')).toBe(false)
      act(() => vi.advanceTimersByTime(449))
      expect(lift()).not.toBeNull()
      act(() => vi.advanceTimersByTime(1))
      expect(lift()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports quiet hovers with a tooltip position and other hovers by country', () => {
    const props = render()
    const hit = (iso: string) => container.querySelector<SVGPathElement>(`.hs-hits path[data-iso="${iso}"]`)!
    act(() => hit('804').dispatchEvent(new PointerEvent('pointerover', { bubbles: true })))
    expect(props.onHover).toHaveBeenLastCalledWith('804')
    act(() => hit('804').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: hit('250') })))
    act(() => hit('250').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: hit('804') })))
    expect(props.onHover).toHaveBeenLastCalledWith(null)
    const [anchorCol, anchorRow] = GRIDS.desktop.anchors['250']
    const [iso, at] = vi.mocked(props.onQuietHover).mock.lastCall!
    expect(iso).toBe('250')
    // The tooltip sits on the country's anchor, in pixels (cell units × px per cell).
    expect(at![0] / at![1]).toBeCloseTo(anchorCol / anchorRow, 5)
  })

  it('labels the map with the top countries', () => {
    render()
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe(
      'World map of news mentions in the last 24 hours. Highest: Ukraine, 412 articles; Russia, 336; China, 298.',
    )
  })

  it('skips the enter animation under reduced motion', () => {
    render({ reduced: true })
    expect(container.querySelectorAll('.hs-base g.enter')).toHaveLength(0)
    act(() => root.unmount())
    root = createRoot(container)
    render({ reduced: false })
    const entering = [...container.querySelectorAll<SVGGElement>('.hs-base g.enter')]
    expect(entering.length).toBe(Object.keys(GRIDS.desktop.cells).length)
    const delay = (iso: string) => Number(group(iso).style.getPropertyValue('--d'))
    // Quiet first: a High country never starts before 3 × 220ms; a quiet one always before 260ms.
    expect(delay('804')).toBeGreaterThanOrEqual(660)
    expect(delay('036')).toBeLessThan(260)
  })
})
