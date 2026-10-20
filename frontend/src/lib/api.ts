import { getTurnstileToken } from './turnstile'
import type { ApiBriefing } from './types'

export async function requestBriefing(
  focus: string,
  signal?: AbortSignal,
  getToken: () => Promise<string | null> = getTurnstileToken,
): Promise<ApiBriefing> {
  // The bot check runs first; its failure surfaces as the briefing error.
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['X-Turnstile-Token'] = token
  const res = await fetch('/api/briefing', {
    method: 'POST',
    headers,
    body: JSON.stringify({ focus }),
    signal,
  })
  if (!res.ok) {
    let detail = 'The backend could not generate a briefing right now.'
    try {
      const payload = await res.json()
      if (typeof payload?.detail === 'string') detail = payload.detail
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new Error(detail)
  }
  return res.json()
}

/**
 * Render's free tier sleeps after idle and takes up to a minute to wake.
 * Fire-and-forget ping on page load so the process is (probably) awake by
 * the time the user submits a focus.
 */
export function warmBackend(): void {
  fetch('/api/health').catch(() => {})
}
