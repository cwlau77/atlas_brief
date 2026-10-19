import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../state/AppState'
import { NavBar } from './NavBar'

describe('NavBar lockup', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><AppStateProvider><NavBar /></AppStateProvider></MemoryRouter>))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('links home with the mark and live "atlas" text', () => {
    const home = container.querySelector('a.wordmark')!
    expect(home.getAttribute('aria-label')).toBe('Atlas home')
    expect(home.getAttribute('href')).toBe('/')
    expect(home.querySelector('svg [data-part="fix"]')).not.toBeNull()
    expect(home.textContent).toBe('atlas')
  })

  it('offers New brief linking home with focus state', () => {
    const link = container.querySelector('a.nav-new')!
    expect(link.textContent).toBe('New brief')
    expect(link.getAttribute('href')).toBe('/')
  })

  it('no longer shows the clock', () => {
    expect(container.querySelector('.nav-clock')).toBeNull()
  })
})
