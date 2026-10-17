import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CursorLens } from './CursorLens'
import { setGlobeReadout } from './cursorBus'

function move(target: Element) {
  const ev = new MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 })
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' })
  act(() => { target.dispatchEvent(ev) })
}

const mode = () => document.documentElement.getAttribute('data-cursor-mode')

describe('CursorLens mode', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    container = document.createElement('div')
    container.innerHTML = '<input id="field" /><a id="link" href="#x">x</a><div id="plain"></div>'
    document.body.appendChild(container)
    root = createRoot(document.createElement('div'))
    act(() => root.render(<CursorLens />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    setGlobeReadout(null)
    vi.unstubAllGlobals()
  })

  it('switches to text over a field and clears again over plain content', () => {
    move(document.getElementById('field')!)
    expect(mode()).toBe('text')
    move(document.getElementById('plain')!)
    expect(mode()).toBeNull()
  })

  it('does not stay stuck on the previous mode', () => {
    move(document.getElementById('link')!)
    expect(mode()).toBe('link')
    move(document.getElementById('field')!)
    expect(mode()).toBe('text')
    move(document.getElementById('plain')!)
    expect(mode()).toBeNull()
  })

  it('shows the globe crosshair while the globe reports a coordinate', () => {
    move(document.getElementById('field')!)
    act(() => setGlobeReadout('12.00°N  43.00°E'))
    move(document.getElementById('plain')!)
    expect(mode()).toBe('globe')
    act(() => setGlobeReadout(null))
    expect(mode()).toBeNull()
  })
})
