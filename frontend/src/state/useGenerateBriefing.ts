import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { requestBriefing, requestBriefingStream, StreamUnavailableError } from '../lib/api'
import { initialLedger, reduceLedger, type LedgerAction, type LedgerState } from '../lib/ledger'
import { normalizeBriefing } from '../lib/normalize'
import { useAppState } from './hooks'

const COLD_START_MS = 8_000
const TIMEOUT_MS = 120_000

type Run = { controller: AbortController; pushed: boolean; cancelled: boolean }

/** AbortSignal.any, with a fallback for browsers before it (Safari < 17.4). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)
  const controller = new AbortController()
  for (const s of signals) {
    if (s.aborted) return AbortSignal.abort(s.reason)
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true })
  }
  return controller.signal
}

/**
 * Generates a briefing from the stream endpoint (falling back once to /briefing), keeping the
 * loading screen's ledger. Each run pushes a history entry, so Back while loading cancels, and
 * success replaces that entry with the briefing.
 */
export function useGenerateBriefing() {
  const { settings, setSession, fileBriefing, pushToast } = useAppState()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerState | null>(null)
  const last = useRef<{ focus: string; frequency: string } | null>(null)
  const run = useRef<Run | null>(null)

  useEffect(() => () => {
    if (run.current) {
      run.current.cancelled = true
      run.current.controller.abort()
    }
  }, [])

  const generate = useCallback(async (focus: string, frequency: string) => {
    last.current = { focus, frequency }
    const current: Run = { controller: new AbortController(), pushed: false, cancelled: false }
    run.current = current
    setLoading(true)
    setError(null)
    setLedger(initialLedger(focus))
    const dispatch = (action: LedgerAction) => setLedger((s) => (s ? reduceLedger(s, action) : s))

    // Keep the router's own state on the entry so its history index stays consistent.
    window.history.pushState({ ...window.history.state, atlasLoading: true }, '')
    current.pushed = true
    const onPopState = () => {
      current.pushed = false
      current.cancelled = true
      current.controller.abort()
    }
    window.addEventListener('popstate', onPopState)
    const cold = window.setTimeout(() => dispatch({ type: 'cold' }), COLD_START_MS)
    const signal = anySignal([current.controller.signal, AbortSignal.timeout(TIMEOUT_MS)])

    try {
      let api
      try {
        api = await requestBriefingStream(focus, signal, dispatch)
      } catch (err) {
        if (!(err instanceof StreamUnavailableError)) throw err
        dispatch({ type: 'fallback' })
        api = await requestBriefing(focus, signal)
      }
      const briefing = normalizeBriefing(api, frequency)
      setSession(briefing)
      if (settings.autoSave) fileBriefing(briefing)
      pushToast(settings.autoSave ? 'Briefing ready and saved to your archive' : 'Briefing ready', 'success', 2600)
      window.removeEventListener('popstate', onPopState)
      navigate(`/brief/${briefing.id}`, { replace: true })
    } catch (err) {
      if (!current.cancelled) {
        setError(
          err instanceof DOMException && err.name === 'TimeoutError'
            ? 'The request timed out. The free-tier backend may still be waking up. Try again in a moment.'
            : err instanceof Error
              ? err.message
              : 'Something went wrong while generating the briefing.',
        )
        // Drop the loading entry so Back doesn't land on it.
        window.removeEventListener('popstate', onPopState)
        if (current.pushed) window.history.back()
      }
    } finally {
      window.clearTimeout(cold)
      window.removeEventListener('popstate', onPopState)
      if (run.current === current) run.current = null
      setLoading(false)
      setLedger(null)
    }
  }, [settings.autoSave, setSession, fileBriefing, pushToast, navigate])

  const cancel = useCallback(() => {
    const current = run.current
    if (!current || current.cancelled) return
    current.cancelled = true
    current.controller.abort()
    if (current.pushed) {
      current.pushed = false
      window.history.back()
    }
  }, [])

  const retry = useCallback(() => {
    if (last.current) void generate(last.current.focus, last.current.frequency)
  }, [generate])

  return { generate, retry, cancel, loading, error, ledger }
}
