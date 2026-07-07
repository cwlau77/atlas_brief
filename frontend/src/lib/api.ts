import type { ApiBriefing } from './types'

export async function requestBriefing(focus: string, signal?: AbortSignal): Promise<ApiBriefing> {
  const res = await fetch('/api/briefing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
