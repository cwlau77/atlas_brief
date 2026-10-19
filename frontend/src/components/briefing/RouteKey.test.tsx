import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROUTE_COLORS, type Route } from '../../lib/routes'
import { RouteKey } from './RouteKey'

const ROUTES: Route[] = [
  { key: 'tension-0', kind: 'tension', i: 0, title: 'Shipping lines ↔ Houthis', stops: [1, 0], lane: 0, color: ROUTE_COLORS[0], dashed: false },
  { key: 'contradiction-0', kind: 'contradiction', i: 0, title: 'Tanker damage', stops: [2, 1], lane: 1, color: ROUTE_COLORS[1], dashed: true },
]

describe('RouteKey', () => {
  let container: HTMLDivElement
  let root: Root
  let scrolled: Element[]
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this) })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('lists each route by kind and title, lighting it on hover and focus and opening it on click', () => {
    const target = document.createElement('article')
    target.id = 'dev-1'
    document.body.appendChild(target)
    const toggle = vi.fn()
    const setHovered = vi.fn()
    act(() => root.render(<RouteKey routes={ROUTES} lit={new Set(['tension-0'])} toggle={toggle} setHovered={setHovered} />))
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.route-key button')]
    expect(buttons.map((b) => b.textContent)).toEqual(['Tension · Shipping lines ↔ Houthis', 'Sources disagree · Tanker damage'])
    expect(buttons[0].classList.contains('lit')).toBe(true)
    expect(buttons[1].classList.contains('lit')).toBe(false)

    act(() => { buttons[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(setHovered).toHaveBeenLastCalledWith('contradiction-0')
    act(() => { buttons[1].dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
    expect(setHovered).toHaveBeenLastCalledWith(null)
    act(() => buttons[0].focus())
    expect(setHovered).toHaveBeenLastCalledWith('tension-0')

    act(() => buttons[0].click())
    expect(toggle).toHaveBeenCalledWith('tension-0')
    expect(scrolled).toEqual([target])
    target.remove()
  })

  it('renders nothing without routes', () => {
    act(() => root.render(<RouteKey routes={[]} lit={new Set()} toggle={() => {}} setHovered={() => {}} />))
    expect(container.querySelector('.route-key')).toBeNull()
  })
})
