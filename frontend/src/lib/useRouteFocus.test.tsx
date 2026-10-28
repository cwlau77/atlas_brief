import { act, lazy, Suspense, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router'
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

  it('focuses a lazy route\'s heading once its chunk has loaded', async () => {
    let resolveChunk!: (m: { default: ComponentType }) => void
    const Lazy = lazy(() => new Promise<{ default: ComponentType }>((r) => { resolveChunk = r }))
    function Shell() {
      useRouteFocus()
      return (
        <>
          <nav><Link to="/lazy">Lazy</Link></nav>
          <main>
            <Routes>
              <Route path="/" element={<h1>Home</h1>} />
              <Route path="/lazy" element={<Suspense fallback={null}><Lazy /></Suspense>} />
            </Routes>
          </main>
        </>
      )
    }
    act(() => {
      root = createRoot(container)
      root.render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>)
    })
    const link = container.querySelector<HTMLAnchorElement>('nav a')!
    link.focus()
    act(() => link.click())
    expect(container.querySelector('main h1')).toBeNull()

    await act(async () => {
      resolveChunk({ default: () => <h1>Lazy page</h1> })
    })
    const h1 = container.querySelector('main h1')
    expect(h1?.textContent).toBe('Lazy page')
    expect(document.activeElement).toBe(h1)
  })

  it('leaves focus alone when the user moved it before the lazy heading arrived', async () => {
    let resolveChunk!: (m: { default: ComponentType }) => void
    const Lazy = lazy(() => new Promise<{ default: ComponentType }>((r) => { resolveChunk = r }))
    function Shell() {
      useRouteFocus()
      return (
        <>
          <nav><Link to="/lazy">Lazy</Link><button type="button">Other</button></nav>
          <main>
            <Routes>
              <Route path="/" element={<h1>Home</h1>} />
              <Route path="/lazy" element={<Suspense fallback={null}><Lazy /></Suspense>} />
            </Routes>
          </main>
        </>
      )
    }
    act(() => {
      root = createRoot(container)
      root.render(<MemoryRouter initialEntries={['/']}><Shell /></MemoryRouter>)
    })
    const link = container.querySelector<HTMLAnchorElement>('nav a')!
    link.focus()
    act(() => link.click())
    const other = container.querySelector<HTMLButtonElement>('nav button')!
    other.focus()
    await act(async () => {
      resolveChunk({ default: () => <h1>Lazy page</h1> })
    })
    expect(document.activeElement).toBe(other)
  })
})
