import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedBriefing } from '../../lib/normalize'
import { buildTensionIndex } from '../../lib/tensionIndex'
import { sortNewestFirst } from '../../lib/timeline'
import { useIndexHighlight, type IndexHighlight } from '../../state/useIndexHighlight'
import { makeBriefing } from '../../test/fixtures'
import { TensionIndex } from './TensionIndex'
import { Timeline } from './Timeline'

let current: IndexHighlight

function Harness({ briefing, onTagTap = () => {} }: { briefing: SavedBriefing; onTagTap?: (i: number) => void }) {
  const highlight = useIndexHighlight()
  current = highlight
  const order = sortNewestFirst(briefing.keyDevelopments)
  const items = buildTensionIndex(briefing, order)
  return (
    <>
      <TensionIndex id="t-index" items={items} devCount={order.length} order={order.map((e) => e.index)} highlight={highlight} />
      <Timeline
        briefing={briefing} timeZone="UTC" showContext reduced items={items} highlight={highlight} indexId="t-index"
        onCardHover={() => {}} onCardFocus={() => {}} onTagTap={onTagTap}
      />
    </>
  )
}

describe('Timeline', () => {
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
    vi.unstubAllGlobals()
  })
  const render = (briefing: SavedBriefing = makeBriefing(), onTagTap?: (i: number) => void) =>
    act(() => root.render(<Harness briefing={briefing} onTagTap={onTagTap} />))
  const cards = () => [...container.querySelectorAll<HTMLElement>('article.dev')]

  it('orders newest first, untimed last', () => {
    // Fixture times: dev 0 at 02:10, dev 2 at 14:32 (falls back to generated_at); dev 1 made untimed.
    const b = makeBriefing()
    b.keyDevelopments[1] = { ...b.keyDevelopments[1], timestamp: '' }
    render(b)
    expect(cards().map((c) => c.id)).toEqual(['dev-2', 'dev-0', 'dev-1'])
    expect(cards()[2].textContent).toContain('Time unknown')
    expect(cards()[0].querySelector('time')!.getAttribute('dateTime')).toBe('2026-10-16T14:32:00Z')
  })

  it('draws no route lanes or key', () => {
    render()
    expect(container.querySelector('.routes, .route-key, .dev-tab, .route-note')).toBeNull()
  })

  it('card shows at most one connection tag with label', () => {
    render()
    const tags = (id: string) => [...container.querySelectorAll(`#${id} .dev-conn`)]
    // Dev 0 (Yemen, Red Sea) links tension 0 and the contradiction.
    expect(tags('dev-0')).toHaveLength(1)
    expect(tags('dev-0')[0].textContent).toBe('1 tension · 1 contradiction')
    expect(tags('dev-2')).toHaveLength(1)
    expect(tags('dev-2')[0].textContent).toBe('1 tension')
    for (const card of cards()) expect(card.querySelectorAll('.dev-conn').length).toBeLessThanOrEqual(1)
  })

  it('renders no connection tag for an unlinked card', () => {
    const b = makeBriefing()
    b.emergingTensions = []
    b.contradictions = []
    render(b)
    expect(container.querySelector('.dev-conn')).toBeNull()
  })

  it('tag click pins first linked item', () => {
    const scroll = vi.fn()
    render()
    container.querySelector<HTMLElement>('#t-index')!.scrollIntoView = scroll
    const tag = container.querySelector<HTMLButtonElement>('#dev-0 .dev-conn')!
    act(() => tag.click())
    expect(scroll).toHaveBeenCalled()
    // The index sorts tension 0 (one link) before the contradiction (one link): tensions first on ties.
    expect(current.pinned).toBe('tension-0')
  })

  it('the connection tag unpins its row when already pinned', () => {
    render()
    container.querySelector<HTMLElement>('#t-index')!.scrollIntoView = () => {}
    act(() => current.pin('tension-0'))
    const tag = container.querySelector<HTMLButtonElement>('#dev-0 .dev-conn')!
    tag.focus()
    act(() => tag.click())
    expect(current.pinned).toBeNull()
    // Unpinning leaves focus on the tag.
    expect(document.activeElement).toBe(tag)
  })

  it('lit and dim classes follow active item', () => {
    render()
    expect(container.querySelector('.dev.is-lit, .dev.is-dim')).toBeNull()
    act(() => current.preview('tension-0'))
    expect(document.getElementById('dev-0')!.classList.contains('is-lit')).toBe(true)
    expect(document.getElementById('dev-1')!.classList.contains('is-dim')).toBe(true)
    expect(document.getElementById('dev-2')!.classList.contains('is-dim')).toBe(true)
    act(() => current.preview(null))
    expect(container.querySelector('.dev.is-lit, .dev.is-dim')).toBeNull()
  })

  it('an active item with no linked developments dims nothing', () => {
    // Tension 2 (grain exporters) links no development.
    render()
    act(() => current.preview('tension-2'))
    expect(container.querySelector('.dev.is-lit, .dev.is-dim')).toBeNull()
  })

  it('connection tag names the index in its label', () => {
    render()
    const tag = container.querySelector<HTMLButtonElement>('#dev-2 .dev-conn')!
    expect(tag.getAttribute('aria-label')).toBe('Show in tension index: 1 tension')
    expect(tag.getAttribute('aria-controls')).toBe('t-index')
  })

  // The tag scrolls to the index; focus goes with it rather than staying on a card the reader left.
  it('tag click moves focus to the pinned row without scrolling again', () => {
    render()
    container.querySelector<HTMLElement>('#t-index')!.scrollIntoView = () => {}
    const tag = container.querySelector<HTMLButtonElement>('#dev-0 .dev-conn')!
    tag.focus()
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    act(() => tag.click())
    const row = container.querySelector<HTMLButtonElement>('#t-index .index-row[aria-pressed="true"]')!
    expect(document.activeElement).toBe(row)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockRestore()
  })

  it('a click inside a card keeps the pin; a click elsewhere clears it', () => {
    render()
    act(() => current.pin('tension-0'))
    act(() => container.querySelector<HTMLElement>('#dev-0 .dev-title')!.click())
    const toggle = container.querySelector<HTMLButtonElement>('#dev-0 .dev-context .text-btn')
    if (toggle) act(() => toggle.click())
    expect(current.pinned).toBe('tension-0')
    act(() => document.body.click())
    expect(current.pinned).toBeNull()
  })

  it('region tag tap keeps a pinned index row', () => {
    render()
    container.querySelector<HTMLElement>('#t-index')!.scrollIntoView = () => {}
    act(() => current.pin('tension-0'))
    const region = container.querySelector<HTMLButtonElement>('#dev-0 .tags button')!
    expect(region.hasAttribute('data-index-control')).toBe(true)
    act(() => region.click())
    expect(current.pinned).toBe('tension-0')
  })

  it('region tag tap reports the development', () => {
    const onTagTap = vi.fn()
    render(makeBriefing(), onTagTap)
    const region = container.querySelector<HTMLButtonElement>('#dev-0 .tags button')!
    expect(region.textContent).toBe('Yemen')
    act(() => region.click())
    expect(onTagTap).toHaveBeenCalledWith(0)
  })
})
