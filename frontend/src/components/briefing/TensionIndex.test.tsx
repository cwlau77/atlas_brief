import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IndexItem } from '../../lib/tensionIndex'
import { ROUTE_COLORS } from '../../lib/routes'
import { useIndexHighlight } from '../../state/useIndexHighlight'
import { TensionIndex } from './TensionIndex'

const ITEMS: IndexItem[] = [
  { key: 'tension-0', kind: 'tension', sides: 'Shipping lines vs Houthis', why: 'Carriers reroute.', devs: [0, 2], color: ROUTE_COLORS[0] },
  { key: 'contradiction-0', kind: 'contradiction', sides: 'Tanker damage', why: 'A / B', devs: [1], color: ROUTE_COLORS[1] },
  { key: 'tension-1', kind: 'tension', sides: 'Navy vs Insurers', why: 'Premiums.', devs: [1], color: null },
  { key: 'tension-2', kind: 'tension', sides: 'Fourth', why: 'Hidden at first.', devs: [], color: null },
]

let pinFromOutside: (key: string) => void = () => {}

function Harness({ onActive }: { onActive: (a: string | null) => void }) {
  const h = useIndexHighlight()
  onActive(h.active)
  pinFromOutside = h.pin
  return <TensionIndex id="tension-index" items={ITEMS} devCount={3} order={[2, 0, 1]} highlight={h} />
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

  it('renders top 3 and reveals the rest', () => {
    expect(container.querySelector('h2')!.textContent).toBe('Tensions · 4')
    expect(rows()).toHaveLength(3)
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Show 1 more')!
    act(() => more.click())
    expect(rows()).toHaveLength(4)
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
    expect(rows()).toHaveLength(4)
    expect(rows()[3].getAttribute('aria-pressed')).toBe('true')
  })

  it('takes an id for in-page links', () => {
    expect(container.querySelector('section.tension-index')!.id).toBe('tension-index')
  })

  it('row is described by its why text and toggle has a contextual label', () => {
    const id = rows()[0].getAttribute('aria-describedby')!
    expect(document.getElementById(id)!.textContent).toBe('Carriers reroute.')
    const toggle = container.querySelector('.index-more')!
    expect(toggle.getAttribute('aria-label')).toBe('Show full reason: Shipping lines vs Houthis')
    expect(toggle.getAttribute('aria-controls')).toBe(id)
  })

  it('strip fills linked developments in order', () => {
    const squares = [...rows()[0].querySelectorAll('.index-strip i')]
    expect(squares).toHaveLength(3)
    // order [2,0,1] with devs [0,2] -> filled, filled, empty
    expect(squares.map((s) => s.classList.contains('on'))).toEqual([true, true, false])
  })

  it('contradiction row shows "Contradiction" and hot marker class', () => {
    const row = rows()[1]
    expect(row.textContent).toContain('Contradiction')
    expect(row.querySelector('.index-kind')!.classList.contains('hot')).toBe(true)
    expect(rows()[0].textContent).toContain('Tension')
  })
})
