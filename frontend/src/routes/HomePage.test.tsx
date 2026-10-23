import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOURCES_CACHE_KEY } from '../lib/sources'
import { AppStateProvider } from '../state/AppState'
import { HomePage } from './HomePage'

vi.mock('../globe/Globe', () => ({ Globe: () => null }))
vi.mock('../state/useGenerateBriefing', () => ({
  useGenerateBriefing: () => ({ generate: vi.fn(), retry: vi.fn(), loading: false, error: null }),
}))

const svc = (name: string, enabled: boolean, finance_only = false) => ({ name, label: name, enabled, finance_only })
const BODY = {
  services: [
    svc('newsapi', true), svc('gdelt', true), svc('google_news', true), svc('guardian', true),
    svc('gnews', true), svc('newsdata', true), svc('brave', false), svc('tavily', true),
    svc('exa', true), svc('finnhub', true, true), svc('marketaux', false, true), svc('alphavantage', false, true),
  ],
  feeds: { count: 26, outlets: ['BBC', 'Al Jazeera'] },
}

describe('HomePage provenance row', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    sessionStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  const render = async () => {
    await act(async () => {
      root.render(<MemoryRouter><AppStateProvider><HomePage /></AppStateProvider></MemoryRouter>)
    })
  }
  const row = () => container.querySelector('.provenance') as HTMLElement
  const spans = () => [...row().querySelectorAll('span')].map((s) => s.textContent)

  it('prints live digits from the cached sources, and links to the section', async () => {
    sessionStorage.setItem(SOURCES_CACHE_KEY, JSON.stringify({ info: BODY, at: Date.now() }))
    await render()
    expect(spans()).toEqual(['8 news services', '26 newsroom feeds', 'Model-written, source-cited'])
    const link = row().querySelector('a')!
    expect(link.textContent).toContain('How Atlas reads')
    expect(link.getAttribute('href')).toBe('#how-atlas-reads')
    expect(container.querySelector('section#how-atlas-reads')).not.toBeNull()
  })

  it('prints no numbers when sources are not known', async () => {
    await render()
    expect(spans().slice(0, 2)).toEqual(['News services', 'Newsroom feeds'])
    expect(container.querySelector('section#how-atlas-reads')).not.toBeNull()
  })
})
