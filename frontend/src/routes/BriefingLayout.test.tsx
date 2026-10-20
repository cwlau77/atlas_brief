import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEYS } from '../lib/storage'
import { AppStateProvider } from '../state/AppState'
import { makeBriefing } from '../test/fixtures'
import { BriefingLayout } from './BriefingLayout'

describe('BriefingLayout masthead', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    localStorage.setItem(KEYS.saved, JSON.stringify([makeBriefing()]))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(
      <MemoryRouter initialEntries={['/brief/b-1']}>
        <AppStateProvider>
          <Routes><Route path="/brief/:id" element={<BriefingLayout />} /></Routes>
        </AppStateProvider>
      </MemoryRouter>,
    ))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    localStorage.clear()
  })

  it('is a compact title row with meta and tabs, without the ask box or contours', () => {
    const head = container.querySelector('.masthead')!
    expect(head.querySelector('h1')!.textContent).toBe('Red sea shipping')
    expect(head.querySelector('form')).toBeNull()
    expect(container.querySelector('.masthead-kicker')).toBeNull()
    expect(container.querySelector('canvas, .contours')).toBeNull()
    expect(head.querySelector('.masthead-row .masthead-meta')!.textContent).toContain('214 articles')
    expect(head.querySelectorAll('nav.tabs a')).toHaveLength(2)
  })

  // Story state (pin, Show more, expanded reasons) belongs to one briefing.
  it('remounts the tab when the briefing changes', () => {
    act(() => root.unmount())
    localStorage.setItem(KEYS.saved, JSON.stringify([makeBriefing(), makeBriefing({ id: 'b-2' })]))
    let go: (to: string) => void = () => {}
    function Tab() {
      const [n, setN] = useState(0)
      go = useNavigate()
      return <button type="button" className="count" onClick={() => setN(n + 1)}>{n}</button>
    }
    root = createRoot(container)
    act(() => root.render(
      <MemoryRouter initialEntries={['/brief/b-1']}>
        <AppStateProvider>
          <Routes>
            <Route path="/brief/:id" element={<BriefingLayout />}><Route index element={<Tab />} /></Route>
          </Routes>
        </AppStateProvider>
      </MemoryRouter>,
    ))
    const count = () => container.querySelector<HTMLButtonElement>('.count')!
    act(() => count().click())
    expect(count().textContent).toBe('1')
    act(() => go('/brief/b-2'))
    expect(count().textContent).toBe('0')
  })
})
