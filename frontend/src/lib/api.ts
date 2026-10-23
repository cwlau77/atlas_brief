import type { StreamEvent } from './ledger'
import { readNdjson } from './ndjson'
import { getTurnstileToken } from './turnstile'
import type { ApiBriefing } from './types'

/** The stream endpoint is missing (an older backend) or the body can't be read as a stream. */
export class StreamUnavailableError extends Error {}

async function postBriefing(path: string, focus: string, signal: AbortSignal | undefined, getToken: () => Promise<string | null>) {
  // The bot check runs first; its failure surfaces as the briefing error.
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['X-Turnstile-Token'] = token
  return fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify({ focus }),
    signal,
  })
}

async function errorDetail(res: Response): Promise<string> {
  let detail = 'The backend could not generate a briefing right now.'
  try {
    const payload = await res.json()
    if (typeof payload?.detail === 'string') detail = payload.detail
  } catch {
    // non-JSON error body — keep the generic message
  }
  return detail
}

export async function requestBriefing(
  focus: string,
  signal?: AbortSignal,
  getToken: () => Promise<string | null> = getTurnstileToken,
): Promise<ApiBriefing> {
  const res = await postBriefing('/api/briefing', focus, signal, getToken)
  if (!res.ok) throw new Error(await errorDetail(res))
  return res.json()
}

/** The same request as requestBriefing, with progress events passed to onEvent as they arrive. */
export async function requestBriefingStream(
  focus: string,
  signal: AbortSignal,
  onEvent: (e: StreamEvent) => void,
  getToken: () => Promise<string | null> = getTurnstileToken,
): Promise<ApiBriefing> {
  const res = await postBriefing('/api/briefing/stream', focus, signal, getToken)
  if (res.status === 404 || res.status === 405) throw new StreamUnavailableError(`stream endpoint answered ${res.status}`)
  if (!res.ok) throw new Error(await errorDetail(res))
  if (!res.body) throw new StreamUnavailableError('response body is not a stream')
  for await (const value of readNdjson(res.body)) {
    const event = value as StreamEvent
    onEvent(event)
    if (event.type === 'error') throw new Error(event.detail)
    if (event.type === 'briefing') return event.briefing
  }
  throw new Error('The connection closed before the briefing was ready. Please try again.')
}

/**
 * Render's free tier sleeps after idle and takes up to a minute to wake.
 * Fire-and-forget ping on page load so the process is (probably) awake by
 * the time the user submits a focus.
 */
export function warmBackend(): void {
  fetch('/api/health').catch(() => {})
}
