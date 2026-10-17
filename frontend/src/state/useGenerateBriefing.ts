import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { requestBriefing } from '../lib/api'
import { normalizeBriefing } from '../lib/normalize'
import { useAppState } from './hooks'

export function useGenerateBriefing() {
  const { settings, setSession, fileBriefing, pushToast } = useAppState()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = useRef<{ focus: string; frequency: string } | null>(null)

  const generate = useCallback(async (focus: string, frequency: string) => {
    last.current = { focus, frequency }
    setLoading(true)
    setError(null)
    try {
      const api = await requestBriefing(focus, AbortSignal.timeout(120_000))
      const briefing = normalizeBriefing(api, frequency)
      setSession(briefing)
      if (settings.autoSave) fileBriefing(briefing)
      pushToast(settings.autoSave ? 'Briefing ready and saved to your archive' : 'Briefing ready', 'success', 2600)
      navigate(`/brief/${briefing.id}`)
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === 'TimeoutError'
          ? 'The request timed out. The free-tier backend may still be waking up. Try again in a moment.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong while generating the briefing.',
      )
    } finally {
      setLoading(false)
    }
  }, [settings.autoSave, setSession, fileBriefing, pushToast, navigate])

  const retry = useCallback(() => {
    if (last.current) void generate(last.current.focus, last.current.frequency)
  }, [generate])

  return { generate, retry, loading, error }
}
