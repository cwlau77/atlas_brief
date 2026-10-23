import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StreamEvent } from '../lib/ledger'
import type { ApiBriefing } from '../lib/types'
import { useGenerateBriefing } from './useGenerateBriefing'

const api = vi.hoisted(() => {
  class StreamUnavailableError extends Error {}
  return { requestBriefing: vi.fn(), requestBriefingStream: vi.fn(), StreamUnavailableError }
})
vi.mock('../lib/api', () => api)

const navigate = vi.fn()
vi.mock('react-router', () => ({ useNavigate: () => navigate }))
vi.mock('./hooks', () => ({
  useAppState: () => ({ settings: { autoSave: false }, setSession: vi.fn(), fileBriefing: vi.fn(), pushToast: vi.fn() }),
}))
vi.mock('../lib/normalize', () => ({ normalizeBriefing: () => ({ id: 'b1' }) }))

const BRIEFING = {} as ApiBriefing
type Hook = ReturnType<typeof useGenerateBriefing>

describe('useGenerateBriefing', () => {
  let container: HTMLDivElement
  let root: Root
  let hook: Hook
  const states: Hook[] = []

  function Probe() {
    hook = useGenerateBriefing()
    states.push(hook)
    return null
  }

  beforeEach(() => {
    vi.useFakeTimers()
    states.length = 0
    navigate.mockReset()
    api.requestBriefing.mockReset()
    api.requestBriefingStream.mockReset()
    container = document.createElement('div')
    root = createRoot(container)
    act(() => root.render(<Probe />))
  })
  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const pending = () => {
    let resolve!: (b: ApiBriefing) => void
    let signal!: AbortSignal
    let emit!: (e: StreamEvent) => void
    api.requestBriefingStream.mockImplementation((_f: string, s: AbortSignal, onEvent: (e: StreamEvent) => void) => {
      signal = s
      emit = onEvent
      return new Promise<ApiBriefing>((res, rej) => {
        resolve = res
        s.addEventListener('abort', () => rej(s.reason))
      })
    })
    return { resolve: (b: ApiBriefing) => resolve(b), signal: () => signal, emit: (e: StreamEvent) => emit(e) }
  }

  it('streams the ledger, then replaces the loading entry with the briefing', async () => {
    const p = pending()
    act(() => { void hook.generate('Sudan ceasefire', 'daily') })
    expect(hook.loading).toBe(true)
    expect(hook.ledger?.focus).toBe('Sudan ceasefire')
    act(() => p.emit({ type: 'plan', place: 'Sudan', queries: 4, is_finance: false, sources: ['rss'] }))
    expect(hook.ledger?.plan?.place).toBe('Sudan')
    await act(async () => p.resolve(BRIEFING))
    expect(navigate).toHaveBeenCalledWith('/brief/b1', { replace: true })
    expect(hook.loading).toBe(false)
  })

  it('falls back to /briefing once when the stream is unavailable', async () => {
    api.requestBriefingStream.mockRejectedValue(new api.StreamUnavailableError('no stream'))
    api.requestBriefing.mockReturnValue(new Promise(() => {}))
    await act(async () => { void hook.generate('Sudan ceasefire', 'daily') })
    expect(api.requestBriefing).toHaveBeenCalledTimes(1)
    expect(hook.ledger?.streaming).toBe(false)
  })

  it('shows the cold-start note after 8 s with no event', () => {
    pending()
    act(() => { void hook.generate('Sudan ceasefire', 'daily') })
    act(() => vi.advanceTimersByTime(7999))
    expect(hook.ledger?.coldStart).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(hook.ledger?.coldStart).toBe(true)
  })

  it('cancel aborts, returns with no error and pops the loading entry once', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const p = pending()
    act(() => { void hook.generate('Sudan ceasefire', 'daily') })
    await act(async () => hook.cancel())
    expect(p.signal().aborted).toBe(true)
    expect(hook.loading).toBe(false)
    expect(hook.error).toBeNull()
    expect(back).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('Back while loading cancels without popping again', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const p = pending()
    act(() => { void hook.generate('Sudan ceasefire', 'daily') })
    await act(async () => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(p.signal().aborted).toBe(true)
    expect(hook.loading).toBe(false)
    expect(hook.error).toBeNull()
    expect(back).not.toHaveBeenCalled()
  })

  it('surfaces an error event as the error and drops the loading entry', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    api.requestBriefingStream.mockRejectedValue(new Error('No recent articles matched.'))
    await act(async () => { void hook.generate('Sudan ceasefire', 'daily') })
    expect(hook.error).toBe('No recent articles matched.')
    expect(hook.loading).toBe(false)
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('explains a timeout', async () => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    api.requestBriefingStream.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await act(async () => { void hook.generate('Sudan ceasefire', 'daily') })
    expect(hook.error).toMatch(/timed out/)
  })
})
