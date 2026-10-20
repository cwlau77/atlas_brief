// Cloudflare Turnstile: a token proving a browser (not a script) asked for a
// briefing. Only active when VITE_TURNSTILE_SITE_KEY is set at build time; the
// backend checks the token when its TURNSTILE_SECRET_KEY is set.
// One "managed" widget, invisible unless Cloudflare wants a click, executed per request.

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  execute: (id: string) => void
  reset: (id: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TIMEOUT_MS = 30_000
const FAILED = "Couldn't confirm you're a person. Check your connection and try again."

let widget: Promise<{ api: TurnstileApi; id: string }> | null = null
let pending: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null

function loadApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error(FAILED)))
    script.onerror = () => reject(new Error(FAILED))
    document.head.appendChild(script)
  })
}

function ensureWidget(siteKey: string) {
  widget ??= loadApi().then((api) => {
    const slot = document.createElement('div')
    slot.className = 'turnstile-slot'
    document.body.appendChild(slot)
    const id = api.render(slot, {
      sitekey: siteKey,
      execution: 'execute',
      appearance: 'interaction-only',
      callback: (token: string) => { pending?.resolve(token); pending = null },
      'error-callback': () => { pending?.reject(new Error(FAILED)); pending = null },
      'expired-callback': () => {},
    })
    return { api, id }
  }).catch((err) => {
    widget = null // let the next request try loading again
    throw err
  })
  return widget
}

/** A fresh single-use token, or null when Turnstile isn't configured. */
export async function getTurnstileToken(siteKey: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''): Promise<string | null> {
  if (!siteKey) return null
  const { api, id } = await ensureWidget(siteKey)
  return new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => { pending = null; reject(new Error(FAILED)) }, TIMEOUT_MS)
    pending = {
      resolve: (t) => { window.clearTimeout(timer); resolve(t) },
      reject: (e) => { window.clearTimeout(timer); reject(e) },
    }
    api.reset(id) // tokens are single-use
    api.execute(id)
  })
}
