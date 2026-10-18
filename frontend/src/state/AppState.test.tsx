import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KEYS } from '../lib/storage'
import { makeBriefing } from '../test/fixtures'
import { AppStateProvider } from './AppState'
import type { AppStateValue } from './context'
import { useAppState } from './hooks'

let latestApi: AppStateValue | null = null
function Capture() {
  latestApi = useAppState()
  return null
}

describe('AppStateProvider', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    latestApi = null
    container = document.createElement('div')
    document.body.appendChild(container)
    act(() => {
      root = createRoot(container)
      root.render(
        <AppStateProvider>
          <Capture />
        </AppStateProvider>,
      )
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('persists archive changes to localStorage', () => {
    act(() => {
      latestApi!.fileBriefing(makeBriefing({ id: 'p', area: 'topic-p' }))
    })
    expect(JSON.parse(window.localStorage.getItem(KEYS.saved)!).map((b: { id: string }) => b.id)).toEqual(['p'])
  })

  it('shows one storage-failure toast when a delete cannot be saved', () => {
    act(() => {
      latestApi!.fileBriefing(makeBriefing({ id: 'd', area: 'topic-d' }))
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    act(() => {
      latestApi!.removeBriefing('d')
    })
    expect(latestApi!.saved).toEqual([])
    expect(latestApi!.toasts.filter((t) => t.tone === 'error')).toHaveLength(1)
  })

  it('keeps both entries when fileBriefing is called twice before a re-render settles', () => {
    const a = makeBriefing({ id: 'a', area: 'topic-a' })
    const b = makeBriefing({ id: 'b', area: 'topic-b' })
    act(() => {
      latestApi!.fileBriefing(a)
      latestApi!.fileBriefing(b)
    })
    expect(latestApi!.saved.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('does not resurrect a deleted briefing when a stale fileBriefing call resolves later', () => {
    const x = makeBriefing({ id: 'x', area: 'topic-x' })
    act(() => {
      latestApi!.fileBriefing(x)
    })
    // A generation that started before the delete captured this reference.
    const staleFileBriefing = latestApi!.fileBriefing
    act(() => {
      latestApi!.removeBriefing('x')
    })
    expect(latestApi!.saved).toEqual([])

    const y = makeBriefing({ id: 'y', area: 'topic-y' })
    act(() => {
      staleFileBriefing(y)
    })
    expect(latestApi!.saved.map((s) => s.id)).toEqual(['y'])
  })
})
