import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SOURCES_CACHE_KEY, STATIC_SERVICE_LABELS, countWord, liveServiceCount, loadSources, peekSources, type SourcesInfo } from './sources'

function stubFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

const svc = (name: string, enabled: boolean, finance_only = false) => ({ name, label: name, enabled, finance_only })
const BODY = {
  services: [
    svc('newsapi', true), svc('gdelt', true), svc('google_news', true), svc('guardian', true),
    svc('gnews', true), svc('newsdata', true), svc('brave', false), svc('tavily', true),
    svc('exa', true), svc('finnhub', true, true), svc('marketaux', false, true), svc('alphavantage', false, true),
  ],
  feeds: { count: 26, outlets: ['BBC', 'Al Jazeera'] },
}

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('loadSources', () => {
  it('maps finance_only to financeOnly and caches for the session', async () => {
    const fetch = stubFetch(BODY)
    const info = await loadSources()
    expect(info?.feeds).toEqual({ count: 26, outlets: ['BBC', 'Al Jazeera'] })
    expect(info?.services.find((s) => s.name === 'finnhub')).toMatchObject({ financeOnly: true, enabled: true })
    expect(info?.services.find((s) => s.name === 'gdelt')?.financeOnly).toBe(false)
    expect(window.sessionStorage.getItem(SOURCES_CACHE_KEY)).not.toBeNull()
    await loadSources()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resolves null on a 404', async () => {
    stubFetch({}, false)
    expect(await loadSources()).toBeNull()
  })

  it('resolves null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await loadSources()).toBeNull()
  })

  it('resolves null on a malformed body', async () => {
    stubFetch({ services: BODY.services, feeds: { outlets: [] } })
    expect(await loadSources()).toBeNull()
  })
})

describe('peekSources', () => {
  it('returns the cached copy synchronously, then null after 30 minutes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'))
    expect(peekSources()).toBeNull()
    stubFetch(BODY)
    await loadSources()
    expect(peekSources()?.feeds.count).toBe(26)
    vi.setSystemTime(new Date('2026-10-22T12:29:00Z'))
    expect(peekSources()).not.toBeNull()
    vi.setSystemTime(new Date('2026-10-22T12:31:00Z'))
    expect(peekSources()).toBeNull()
  })
})

describe('liveServiceCount', () => {
  it('counts enabled non-finance services', async () => {
    stubFetch(BODY)
    const info = (await loadSources()) as SourcesInfo
    expect(liveServiceCount(info)).toBe(8)
  })
})

describe('countWord', () => {
  it('spells one to nine and leaves the rest as digits', () => {
    expect(countWord(8)).toBe('eight')
    expect(countWord(1)).toBe('one')
    expect(countWord(26)).toBe('26')
    expect(countWord(10)).toBe('10')
  })
})

describe('STATIC_SERVICE_LABELS', () => {
  it('holds the twelve service labels', () => {
    expect(STATIC_SERVICE_LABELS).toHaveLength(12)
  })
})
