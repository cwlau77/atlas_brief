import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { StrictMode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialLedger, type LedgerState } from '../lib/ledger'
import { SOURCES_CACHE_KEY } from '../lib/sources'
import { AppStateProvider } from '../state/AppState'
import { HomePage } from './HomePage'

const hook = vi.hoisted(() => ({
  state: { loading: false, ledger: null as LedgerState | null },
  globeProps: [] as unknown[],
  generate: vi.fn(),
}))
vi.mock('../globe/Globe', () => ({
  Globe: (props: unknown) => {
    hook.globeProps.push(props)
    return <div className="globe-stub" />
  },
}))
vi.mock('../state/useGenerateBriefing', () => ({
  useGenerateBriefing: () => ({ generate: hook.generate, retry: vi.fn(), cancel: vi.fn(), error: null, ...hook.state }),
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

describe('HomePage loading screen', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    sessionStorage.clear()
    hook.state = { loading: false, ledger: null }
    hook.globeProps.length = 0
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
  const lastGlobe = () => hook.globeProps[hook.globeProps.length - 1] as { loading?: { target: unknown; feedOutlets: string[] } }

  it('swaps the copy for the ledger and keeps the same globe', async () => {
    await render()
    const globe = container.querySelector('.globe-stub')
    expect(container.querySelector('.home-copy')).not.toBeNull()

    hook.state = { loading: true, ledger: initialLedger('Sudan ceasefire talks') }
    await render()
    expect(container.querySelector('.ledger h1')?.textContent).toBe('Sudan ceasefire talks')
    expect(container.querySelector('.globe-stub')).toBe(globe)
    expect(lastGlobe().loading).toBeUndefined()

    hook.state = { loading: true, ledger: { ...initialLedger('Sudan ceasefire talks'), plan: { place: 'Sudan', queries: 4, sources: ['rss'] }, feedOutlets: { 'BBC World': 3 } } }
    await render()
    expect(lastGlobe().loading).toEqual({ target: { lat: 12.9, lng: 30.2 }, feedOutlets: ['BBC World'] })
  })

  it('places a placeless plan nowhere', async () => {
    hook.state = { loading: true, ledger: { ...initialLedger('chip export controls'), plan: { place: null, queries: 3, sources: [] } } }
    await render()
    expect(lastGlobe().loading?.target).toBeNull()
  })

  it('returns focus to the ask box when loading ends without a briefing', async () => {
    hook.state = { loading: true, ledger: initialLedger('Sudan ceasefire talks') }
    await render()
    hook.state = { loading: false, ledger: null }
    await render()
    expect(document.activeElement?.id).toBe('home-ask')
  })
})


describe('HomePage briefFocus router state', () => {
  let container: HTMLDivElement
  let root: Root
  let seen: unknown
  beforeEach(() => {
    sessionStorage.clear()
    hook.state = { loading: false, ledger: null }
    hook.generate.mockReset()
    seen = undefined
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
  function Probe() {
    seen = useLocation().state
    return null
  }
  const renderWith = async (state: unknown) => {
    await act(async () => {
      root.render(
        <StrictMode>
          <MemoryRouter initialEntries={[{ pathname: '/', state }]}><AppStateProvider><Probe /><HomePage /></AppStateProvider></MemoryRouter>
        </StrictMode>,
      )
    })
  }

  it('starts a briefing from briefFocus router state exactly once', async () => {
    await renderWith({ briefFocus: 'Red Sea shipping' })
    expect(hook.generate).toHaveBeenCalledTimes(1)
    expect(hook.generate).toHaveBeenCalledWith('Red Sea shipping', 'daily')
    expect(seen).toBeNull()
  })

  it('ignores an empty briefFocus', async () => {
    await renderWith({ briefFocus: '' })
    expect(hook.generate).not.toHaveBeenCalled()
  })
})
