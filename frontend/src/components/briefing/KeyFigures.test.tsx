import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FigureKind, ViewKeyFigure } from '../../lib/normalize'
import { KeyFigures } from './KeyFigures'

const fig = (figure: string, label: string, kind: FigureKind | null, outlet: string, published_at: string | null, period: string | null = null): ViewKeyFigure => ({
  figure, label, kind, period, source: { outlet, url: `https://${outlet}/a`, published_at },
})

const SUDAN = [
  fig('34 million people', 'need humanitarian support', 'people', 'news.un.org', '2026-10-21T12:08:05Z'),
  fig('19.5 million', 'face acute hunger', 'people', 'allAfrica.com', '2026-10-26T04:47:44Z'),
  fig('Nearly 14 million', 'forced from their homes', 'people', 'elon.edu', '2026-10-21T12:05:57Z'),
]
const CEPR = [
  fig('around 8%', "China's average tariff on US goods", 'share', 'cepr.org', '2026-10-26T00:00:00Z', 'before 2018'),
  fig('roughly 20%', "China's average tariff on US goods", 'share', 'cepr.org', '2026-10-26T00:00:00Z'),
  fig('below 10%', "China's tariffs on other origins", 'share', 'cepr.org', '2026-10-26T00:00:00Z'),
]

describe('KeyFigures', () => {
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
  const render = (figures: ViewKeyFigure[]) => act(() => root.render(<KeyFigures figures={figures} timeZone="UTC" />))
  const bars = () => [...container.querySelectorAll<HTMLElement>('.kf-bar > b')].map((b) => parseFloat(b.style.width))

  it('renders nothing without figures', () => {
    render([])
    expect(container.innerHTML).toBe('')
  })

  it('draws comparable counts as bars on one scale, labelled and linked', () => {
    render(SUDAN)
    expect(container.querySelector('.kf-h')?.textContent).toBe('Key figures')
    const list = container.querySelector('ul[aria-label="Key figures"]')!
    expect(list.querySelectorAll('li')).toHaveLength(3)
    const [a, b, c] = bars()
    expect(a).toBe(100)
    expect(b).toBeCloseTo(57.35, 1)
    expect(c).toBeCloseTo(41.18, 1)
    expect([...container.querySelectorAll('.kf-bar')].every((el) => el.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(container.querySelector('.kf-cap')?.textContent).toBe('People · one scale from zero · 3 outlets, 21–26 Oct')
    const link = container.querySelector<HTMLAnchorElement>('.kf-src')!
    expect(link.textContent).toBe('news.un.org, 21 Oct')
    expect(link.querySelector('svg')).not.toBeNull()
    expect(container.textContent).not.toContain('↗')
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noopener noreferrer')
    expect(link.getAttribute('aria-label')).toBe('Read in news.un.org: 34 million people need humanitarian support')
  })

  it('draws shares as meters, marks a limit and shows the period', () => {
    render(CEPR)
    expect(container.querySelectorAll('.kf-bar.meter')).toHaveLength(2)
    expect(bars()).toEqual([8, 20])
    expect(container.querySelectorAll('.kf-row')[2].querySelector('.kf-bar')?.textContent).toBe('a limit, not charted')
    expect(container.querySelector('.kf-period')?.textContent).toBe(' · before 2018')
  })

  it('links an undated figure by outlet alone, with no bar or caption for a single figure', () => {
    render([fig('$5 billion', 'Chinese investment in the Suez Canal zone', 'money', 'thediplomat.com', null)])
    expect(container.querySelector('.kf-src')?.textContent).toBe('thediplomat.com')
    expect(container.querySelector('.kf-bar')).toBeNull()
    expect(container.querySelector('.kf-cap')).toBeNull()
  })

  it('puts the chart rows first and the odd one out after the caption', () => {
    render([SUDAN[0], fig('$5 billion', 'pledged', 'money', 'a.org', null), SUDAN[1]])
    const order = [...container.querySelectorAll('.kf-fig, .kf-cap')].map((el) => el.textContent)
    expect(order).toEqual(['34 million people', '19.5 million', 'People · one scale from zero · 2 outlets, 21–26 Oct', '$5 billion'])
  })
})
