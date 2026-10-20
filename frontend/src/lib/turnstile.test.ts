import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Opts = { sitekey: string; callback: (t: string) => void; 'error-callback': () => void }

// A stand-in for Cloudflare's window.turnstile that hands out numbered tokens.
function fakeTurnstile(fail = false) {
  let opts: Opts | null = null
  let n = 0
  const api = {
    render: vi.fn((_el: HTMLElement, o: Opts) => { opts = o; return 'w1' }),
    reset: vi.fn(),
    execute: vi.fn(() => {
      queueMicrotask(() => (fail ? opts!['error-callback']() : opts!.callback(`token-${++n}`)))
    }),
  }
  vi.stubGlobal('turnstile', api)
  return api
}

describe('getTurnstileToken', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => {
    vi.unstubAllGlobals()
    document.querySelectorAll('.turnstile-slot, script[src*="turnstile"]').forEach((el) => el.remove())
  })

  it('is a no-op without a site key', async () => {
    const { getTurnstileToken } = await import('./turnstile')
    expect(await getTurnstileToken('')).toBeNull()
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull()
  })

  it('renders one managed widget and gives a fresh token per request', async () => {
    const api = fakeTurnstile()
    const { getTurnstileToken } = await import('./turnstile')
    expect(await getTurnstileToken('site')).toBe('token-1')
    expect(await getTurnstileToken('site')).toBe('token-2')
    expect(api.render).toHaveBeenCalledTimes(1)
    const opts = api.render.mock.calls[0][1] as unknown as Record<string, string>
    expect(opts.sitekey).toBe('site')
    expect(opts.execution).toBe('execute')
    expect(opts.appearance).toBe('interaction-only')
    expect(api.reset).toHaveBeenCalledTimes(2)
    expect(document.querySelectorAll('.turnstile-slot')).toHaveLength(1)
  })

  it('rejects with a readable message when the check fails', async () => {
    fakeTurnstile(true)
    const { getTurnstileToken } = await import('./turnstile')
    await expect(getTurnstileToken('site')).rejects.toThrow(/confirm you're a person/)
  })
})

describe('requestBriefing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the token as X-Turnstile-Token, or no header without one', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetch)
    const { requestBriefing } = await import('./api')
    await requestBriefing('red sea', undefined, async () => 'tok')
    await requestBriefing('red sea', undefined, async () => null)
    const headers = (i: number) => (fetch.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers(0)['X-Turnstile-Token']).toBe('tok')
    expect(headers(1)['X-Turnstile-Token']).toBeUndefined()
  })
})
