import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import css from './hotspots.css?raw'
import { leaderPath, type Pt } from './layout'
import { Overlay, type OverlayProps } from './Overlay'

describe('Overlay', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  const anchor: Pt = [200, 150]
  const box = { x: 300, y: 60, w: 288, h: 392 }
  const render = (over: Partial<OverlayProps> = {}) => {
    const props: OverlayProps = { anchor, box, side: 'l', arcs: [[500, 120], [90, 200]], reduced: false, seq: 1, ...over }
    act(() => root.render(<Overlay {...props} />))
    return container.querySelector('svg')!
  }

  it('draws the point, ring, leader and one arc with an end ring per co-mention, on the mockup timings', () => {
    const svg = render()
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    const leader = svg.querySelector<SVGPathElement>('.hs-leader')!
    expect(leader.getAttribute('d')).toBe(leaderPath(anchor, box, 'l'))
    expect(svg.querySelector('.hs-pt')?.getAttribute('cx')).toBe('200')
    expect(svg.querySelector('.hs-ring')).not.toBeNull()
    const arcs = [...svg.querySelectorAll<SVGPathElement>('.hs-arc')]
    expect(arcs.map((a) => a.style.animationDelay)).toEqual(['950ms', '1090ms'])
    expect(arcs[0].getAttribute('d')).toMatch(/^M200,150 Q[\d.-]+,[\d.-]+ 500,120$/)
    const ends = [...svg.querySelectorAll<SVGCircleElement>('.hs-arc-end')]
    expect(ends.map((e) => e.style.animationDelay)).toEqual(['1550ms', '1690ms'])
    expect(svg.classList.contains('is-reduced')).toBe(false)
    // the sequence's timings live in the stylesheet
    expect(css).toMatch(/\.hs-pt \{[^}]*animation: hs-pop 0\.2s [^;]* 320ms both/)
    expect(css).toMatch(/\.hs-leader \{[^}]*animation: hs-draw 0\.3s [^;]* 500ms both/)
    expect(css).toMatch(/\.hs-arc \{[^}]*animation: hs-draw 0\.7s/)
  })

  it('draws no leader without a card box (docked or sheet), and nothing without an anchor', () => {
    const svg = render({ box: null, side: null })
    expect(svg.querySelector('.hs-leader')).toBeNull()
    expect(svg.querySelector('.hs-pt')).not.toBeNull()
    const empty = render({ anchor: null, box: null, side: null })
    expect(empty.querySelector('.hs-pt, .hs-leader, .hs-arc')).toBeNull()
  })

  it('restarts the sequence when seq changes', () => {
    render({ seq: 1 })
    const first = container.querySelector('.hs-leader')
    render({ seq: 2 })
    expect(container.querySelector('.hs-leader')).not.toBe(first)
  })

  it('overlay shows everything at once under reduced motion', () => {
    const svg = render({ reduced: true })
    expect(svg.classList.contains('is-reduced')).toBe(true)
    expect(svg.querySelectorAll('.hs-arc')).toHaveLength(2)
    expect(svg.querySelector('.hs-leader')).not.toBeNull()
    expect(css).toMatch(/\.hs-overlay\.is-reduced \*[^{]*\{\s*animation: none !important;/)
  })
})
