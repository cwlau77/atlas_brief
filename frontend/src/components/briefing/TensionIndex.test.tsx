import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndexItem } from '../../lib/tensionIndex'
import { ROUTE_COLORS } from '../../lib/routes'
import { useIndexHighlight, type IndexHighlight } from '../../state/useIndexHighlight'
import { TensionIndex } from './TensionIndex'

const ITEMS: IndexItem[] = [
  { key: 'tension-0', kind: 'tension', sides: 'Shipping lines vs Houthis', why: 'Carriers reroute.', devs: [0, 2], color: ROUTE_COLORS[0],
    relation: 'In open conflict', linked: [{ dev: 2, title: 'Second', timestamp: '2026-10-26T09:00:00Z' }, { dev: 0, title: 'First', timestamp: '2026-10-26T09:00:00Z' }] },
  { key: 'contradiction-0', kind: 'contradiction', sides: 'Tanker damage', why: 'A / B', devs: [1], color: ROUTE_COLORS[1],
    relation: 'Same event, different accounts', linked: [{ dev: 1, title: 'Third', timestamp: '2026-10-26T09:00:00Z' }] },
  { key: 'tension-1', kind: 'tension', sides: 'Navy vs Insurers', why: 'Premiums.', devs: [1], color: null, relation: null,
    linked: [{ dev: 1, title: 'Third', timestamp: '2026-10-26T09:00:00Z' }] },
  { key: 'tension-2', kind: 'tension', sides: 'Fourth', why: 'Hidden at first.', devs: [], color: null, relation: null, linked: [] },
]

let pinFromOutside: (key: string) => void = () => {}
let pinnedNow: string | null = null
const open = vi.fn()

function Harness({ onActive }: { onActive: (a: string | null) => void }) {
  const h = useIndexHighlight()
  onActive(h.active)
  pinFromOutside = h.pin
  pinnedNow = h.pinned
  return <TensionIndex id="tension-index" items={ITEMS} highlight={h} timeZone="UTC" onOpen={open} />
}

describe('TensionIndex', () => {
  let container: HTMLDivElement
  let root: Root
  let active: string | null
  beforeEach(() => {
    active = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<Harness onActive={(a) => { active = a }} />))
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })
  const rows = () => [...container.querySelectorAll<HTMLButtonElement>('button.index-row')]
  const visibleRows = () => rows().filter((r) => !r.closest('li')!.classList.contains('is-overflow'))

  it('renders top 3 and reveals the rest', () => {
    expect(container.querySelector('h2')!.textContent).toBe('Tensions · 4')
    expect(visibleRows()).toHaveLength(3)
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Show 1 more')!
    expect(more.classList.contains('text-btn')).toBe(true)
    act(() => more.click())
    expect(visibleRows()).toHaveLength(4)
  })

  // Print shows every row, so the extras stay in the DOM, hidden on screen by a class.
  it('keeps rows beyond the top 3 in the DOM behind a class', () => {
    expect(rows()).toHaveLength(4)
    const extra = container.querySelectorAll('li.index-item')[3]
    expect(extra.classList.contains('is-overflow')).toBe(true)
    expect(extra.textContent).toContain('Fourth')
  })

  it('a click that unpins also ends the row preview', () => {
    act(() => { rows()[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    act(() => rows()[0].click())
    expect(active).toBe('tension-0')
    act(() => rows()[0].click())
    expect(active).toBeNull()
    expect(container.querySelector('li.index-item.active')).toBeNull()
  })

  it('hover previews and leave reverts to pinned', () => {
    act(() => rows()[0].click())
    act(() => { rows()[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(active).toBe('contradiction-0')
    act(() => { rows()[1].dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
    expect(active).toBe('tension-0')
  })

  it('click pins, second click unpins', () => {
    act(() => rows()[0].click())
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true')
    act(() => rows()[0].click())
    expect(rows()[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('Escape clears pin', () => {
    act(() => rows()[0].click())
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(active).toBeNull()
    expect(rows()[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('click outside unpins; inside (including Show more) does not', () => {
    act(() => rows()[0].click())
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Show 1 more')!
    act(() => more.click())
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true')
    // A touch scroll starts with pointerdown and never clicks: the pin stays.
    act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true')
    act(() => { document.body.click() })
    expect(rows()[0].getAttribute('aria-pressed')).toBe('false')
  })

  it('a click on a control marked data-index-control keeps the pin', () => {
    act(() => rows()[0].click())
    const control = document.createElement('button')
    control.dataset.indexControl = ''
    document.body.appendChild(control)
    act(() => control.click())
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true')
    control.remove()
  })

  it('shows every row when the pinned item sits below the top 3', () => {
    act(() => { pinFromOutside('tension-2') })
    expect(visibleRows()).toHaveLength(4)
    expect(rows()[3].getAttribute('aria-pressed')).toBe('true')
  })

  it('takes an id for in-page links', () => {
    expect(container.querySelector('section.tension-index')!.id).toBe('tension-index')
  })

  it('row is described by its why text and toggle has a contextual label', () => {
    const id = rows()[0].getAttribute('aria-describedby')!
    expect(document.getElementById(id)!.textContent).toBe('Carriers reroute.')
    const toggle = container.querySelector('.index-more')!
    // Label in name (WCAG 2.5.3): the accessible name contains the visible text.
    expect(toggle.textContent).toBe('More')
    expect(toggle.getAttribute('aria-label')).toBe('More: Shipping lines vs Houthis')
    expect(toggle.getAttribute('aria-controls')).toBe(id)
    act(() => (toggle as HTMLButtonElement).click())
    expect(toggle.textContent).toBe('Less')
    expect(toggle.getAttribute('aria-label')).toBe('Less: Shipping lines vs Houthis')
  })

  it('shows the relationship under the actors, inside the row button', () => {
    // A visually hidden comma keeps the accessible name reading "…coalition, In open conflict".
    expect(rows()[0].querySelector('.index-relation')!.textContent).toBe(', In open conflict')
    expect(rows()[1].querySelector('.index-relation')!.textContent).toBe(', Same event, different accounts')
    expect(rows()[0].querySelector('.index-relation .visually-hidden')!.textContent).toBe(', ')
    // A tension with no relationship shows no line.
    expect(rows()[2].querySelector('.index-relation')).toBeNull()
  })

  it('has no square strip', () => {
    expect(container.querySelector('.index-strip')).toBeNull()
  })

  it('names linked developments with their date, in the order given', () => {
    const ties = [...container.querySelectorAll<HTMLButtonElement>('.index-item:first-child .index-ties button')]
    expect(ties.map((t) => t.getAttribute('aria-label'))).toEqual(['Go to development: Second', 'Go to development: First'])
    expect(ties[0].querySelector('.index-tie-title')!.textContent).toBe('Second')
    expect(ties[0].querySelector('time')!.getAttribute('dateTime')).toBe('2026-10-26T09:00:00Z')
    // Day and month only, as in the Archive: the title needs the room.
    expect(ties[0].querySelector('time')!.textContent).toBe('26 Oct')
    expect(container.querySelector('.index-item:first-child .index-ties')!.textContent).toContain('Ties to')
  })

  it('a Ties to button opens its development and leaves the pin alone', () => {
    open.mockClear()
    act(() => pinFromOutside('tension-0'))
    const tie = container.querySelector<HTMLButtonElement>('.index-item:first-child .index-ties button')!
    act(() => tie.click())
    expect(open).toHaveBeenCalledWith('dev-2')
    expect(pinnedNow).toBe('tension-0')
  })

  it('says when a row ties to no development', () => {
    const last = container.querySelectorAll('li.index-item')[3]
    expect(last.querySelector('.index-ties')!.textContent).toContain('Not tied to one development in this brief')
    expect(last.querySelectorAll('.index-ties button')).toHaveLength(0)
  })

  it('contradiction row shows "Contradiction" and hot marker class', () => {
    const row = rows()[1]
    expect(row.textContent).toContain('Contradiction')
    expect(row.querySelector('.index-kind')!.classList.contains('hot')).toBe(true)
    expect(rows()[0].textContent).toContain('Tension')
  })
})

describe('TensionIndex reason toggle', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    // Fake layout: a reason clamps at 40px and needs 80px when its text runs past 20 characters.
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return 40 } })
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true, get(this: HTMLElement) { return (this.textContent ?? '').length > 20 ? 80 : 40 },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    // jsdom defines both on Element.prototype; dropping the overrides restores them.
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight
  })

  function Long() {
    const h = useIndexHighlight()
    const items: IndexItem[] = [
      { key: 'a', kind: 'tension', sides: 'Short', why: 'Fits.', devs: [0], color: null, relation: null, linked: [] },
      { key: 'b', kind: 'tension', sides: 'Long', why: 'A reason long enough to overflow two lines.', devs: [0], color: null, relation: null, linked: [] },
    ]
    return <TensionIndex items={items} highlight={h} timeZone="UTC" onOpen={() => {}} />
  }

  it('shows "more" only for a reason that overflows its clamp', () => {
    act(() => root.render(<Long />))
    const toggles = [...container.querySelectorAll('.index-more')]
    expect(toggles).toHaveLength(1)
    expect(toggles[0].getAttribute('aria-label')).toBe('More: Long')
  })
})

describe('TensionIndex rows', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  const stub = (pinned: string | null = null): IndexHighlight => ({
    pinned, previewed: null, active: pinned, pin: vi.fn(), preview: vi.fn(), clear: vi.fn(),
  })
  const render = (highlight: IndexHighlight) =>
    act(() => root.render(<TensionIndex id="t" items={ITEMS} highlight={highlight} timeZone="UTC" onOpen={() => {}} />))
  const li = (i = 0) => container.querySelectorAll<HTMLElement>('li.index-item')[i]
  const click = (el: Element, detail: number) =>
    act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail })) })
  // React listens for mouseover/mouseout to synthesize enter and leave.
  const enter = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body })) })
  const leave = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })) })

  it('previews when the pointer enters anywhere on the row', () => {
    const h = stub()
    render(h)
    enter(li())
    expect(h.preview).toHaveBeenCalledWith('tension-0')
    leave(li())
    expect(h.preview).toHaveBeenLastCalledWith(null)
  })

  it('clicking the reason text pins the row', () => {
    const h = stub()
    render(h)
    click(li().querySelector('.index-why')!, 1)
    expect(h.pin).toHaveBeenCalledTimes(1)
    expect(h.pin).toHaveBeenCalledWith('tension-0')
  })

  it('clicking More does not pin', () => {
    const h = stub()
    render(h)
    click(li().querySelector('.index-more')!, 1)
    expect(h.pin).not.toHaveBeenCalled()
  })

  it('ignores the second click of a double-click', () => {
    const h = stub()
    render(h)
    click(li(), 2)
    expect(h.pin).not.toHaveBeenCalled()
    click(li(), 1)
    expect(h.pin).toHaveBeenCalledTimes(1)
    click(li(), 0)
    expect(h.pin).toHaveBeenCalledTimes(2)
  })

  it('marks the pinned row', () => {
    render(stub('tension-1'))
    expect(li(2).classList.contains('is-pinned')).toBe(true)
    expect(li(2).querySelector('.index-row')!.getAttribute('aria-pressed')).toBe('true')
    expect(li(0).classList.contains('is-pinned')).toBe(false)
  })

  it('keeps revealed rows after the pin clears', () => {
    render(stub('tension-2'))
    expect(container.querySelectorAll('li.is-overflow')).toHaveLength(0)
    render(stub(null))
    expect(container.querySelectorAll('li.is-overflow')).toHaveLength(0)
    expect(container.textContent).not.toContain('Show 1 more')
  })
})
