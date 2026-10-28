import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOTSPOTS_CACHE_KEY, fetchSnapshot, isPartial, isStale, normalizeSnapshot, readCachedSnapshot, type HotspotSnapshot } from './data'

const body = {
  generated_at: '2026-10-28T10:00:00Z',
  window_hours: 24,
  coverage_hours: 20,
  total_articles: 500,
  feeds: 14,
  cutoffs: { active: 15, elevated: 40, high: 80 },
  countries: [
    {
      iso2: 'UA', iso_numeric: '804', name: 'Ukraine', n: 90, tier: 'high', hourly: [1, 2, 3], with: ['RU'],
      story: {
        headline: 'H', blurb: null,
        article: { title: 'T', url: 'https://x.test/a', outlet: 'BBC', published_at: '2026-10-28T09:00:00Z', image_url: null },
        image: { url: 'https://x.test/i.jpg', credit: 'Someone' },
      },
    },
    { iso2: 'SG', iso_numeric: '', name: 'Singapore', n: 3, tier: 'quiet', hourly: [], with: [], story: null },
    { iso2: 'XX', name: 'Bad', n: 'many', tier: 'high' },
    { iso2: 'YY', iso_numeric: '1', name: 'BadTier', n: 1, tier: 'wild', hourly: [], with: [], story: null },
  ],
}

function snap(over: Partial<HotspotSnapshot> = {}): HotspotSnapshot {
  return { generatedAt: '2026-10-28T10:00:00Z', coverageHours: 20, totalArticles: 500, feeds: 14, cutoffs: { active: 15, elevated: 40, high: 80 }, countries: [], ...over }
}

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('normalizeSnapshot', () => {
  it('normalises the API body', () => {
    const s = normalizeSnapshot(body)!
    expect(s.generatedAt).toBe('2026-10-28T10:00:00Z')
    expect(s.coverageHours).toBe(20)
    expect(s.totalArticles).toBe(500)
    expect(s.feeds).toBe(14)
    expect(s.countries.map((x) => x.iso2)).toEqual(['UA', 'SG'])
    const ua = s.countries[0]
    expect(ua.isoNumeric).toBe('804')
    expect(ua.with).toEqual(['RU'])
    expect(ua.story).toEqual({
      headline: 'H', blurb: null, url: 'https://x.test/a', outlet: 'BBC', publishedAt: '2026-10-28T09:00:00Z',
      image: { url: 'https://x.test/i.jpg', credit: 'Someone' },
    })
    expect(s.countries[1].isoNumeric).toBe('')
    expect(s.countries[1].story).toBeNull()
  })
  it('rejects non-snapshots', () => {
    expect(normalizeSnapshot(null)).toBeNull()
    expect(normalizeSnapshot('x')).toBeNull()
    expect(normalizeSnapshot({ countries: [] })).toBeNull()
  })
})

describe('cache', () => {
  it('ignores a malformed or throwing cache', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(readCachedSnapshot()).toBeNull()
    vi.restoreAllMocks()
    window.localStorage.setItem(HOTSPOTS_CACHE_KEY, '{nope')
    expect(readCachedSnapshot()).toBeNull()
    window.localStorage.setItem(HOTSPOTS_CACHE_KEY, JSON.stringify({ countries: 3 }))
    expect(readCachedSnapshot()).toBeNull()
    window.localStorage.clear()
    window.localStorage.setItem('atlasHotspotsV0', JSON.stringify(body))
    expect(readCachedSnapshot()).toBeNull()
  })
  it('fetchSnapshot writes the cache and survives a throwing setItem', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    const s = await fetchSnapshot()
    expect(readCachedSnapshot()).toEqual(s)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    await expect(fetchSnapshot()).resolves.toEqual(s)
    vi.unstubAllGlobals()
  })
})

describe('fetchSnapshot failures', () => {
  it('rejects on 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    await expect(fetchSnapshot()).rejects.toThrow()
    vi.unstubAllGlobals()
  })
  it('rejects on malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('"hi"', { status: 200 })))
    await expect(fetchSnapshot()).rejects.toThrow()
    vi.unstubAllGlobals()
  })
  it('rejects on timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise((_r, rej) => {
      init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })))
    await expect(fetchSnapshot(undefined, 20)).rejects.toThrow()
    vi.unstubAllGlobals()
  })
})

describe('freshness', () => {
  it('isStale after 60 minutes', () => {
    const now = new Date('2026-10-28T11:00:01Z')
    expect(isStale(snap(), now)).toBe(true)
    expect(isStale(snap(), new Date('2026-10-28T10:59:00Z'))).toBe(false)
    expect(isStale(snap({ generatedAt: 'garbage' }), now)).toBe(true)
  })
  it('isPartial flags thin snapshots', () => {
    expect(isPartial(snap())).toBe(false)
    expect(isPartial(snap({ feeds: 4 }))).toBe(true)
    expect(isPartial(snap({ totalArticles: 99 }))).toBe(true)
  })
})
