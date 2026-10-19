import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
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
    expect(head.querySelector('h1')!.textContent).toBe('red sea shipping')
    expect(head.querySelector('form')).toBeNull()
    expect(container.querySelector('.masthead-kicker')).toBeNull()
    expect(container.querySelector('canvas, .contours')).toBeNull()
    expect(head.querySelector('.masthead-row .masthead-meta')!.textContent).toContain('214 articles')
    expect(head.querySelectorAll('nav.tabs a')).toHaveLength(2)
  })
})
