import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouteFocus } from './useRouteFocus'

function Page({ label }: { label: string }) {
  useRouteFocus()
  const navigate = useNavigate()
  return (
    <div>
      <h1>{label}</h1>
      <button type="button" data-action="go" onClick={() => navigate('/b')}>go</button>
      <button type="button" data-action="back" onClick={() => navigate(-1)}>back</button>
    </div>
  )
}

describe('useRouteFocus', () => {
  let container: HTMLDivElement
  let root: Root
  let scrollY = 0
  let calls: unknown[] = []

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    scrollY = 0
    calls = []
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    vi.stubGlobal('scrollTo', vi.fn((arg: { top?: number } | number) => {
      calls.push(arg)
      scrollY = typeof arg === 'object' && arg !== null ? arg.top ?? 0 : (arg ?? 0)
    }))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('restores the previous page\'s scroll position on Back, instantly', () => {
    act(() => {
      root = createRoot(container)
      root.render(
        <MemoryRouter initialEntries={['/a']}>
          <Routes>
            <Route path="/a" element={<Page label="A" />} />
            <Route path="/b" element={<Page label="B" />} />
          </Routes>
        </MemoryRouter>,
      )
    })

    // User scrolls down on page A.
    scrollY = 800
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    // Navigate forward to page B: should land at the top.
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-action="go"]')!.click()
    })
    expect(container.querySelector('h1')?.textContent).toBe('B')
    expect(scrollY).toBe(0)

    // Navigate Back to page A: should restore the saved position, instantly.
    calls = []
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-action="back"]')!.click()
    })
    expect(container.querySelector('h1')?.textContent).toBe('A')
    expect(scrollY).toBe(800)
    expect(calls).toEqual([{ top: 800, left: 0, behavior: 'instant' }])
  })
})
