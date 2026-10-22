import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRENDING_CACHE_KEY, loadTrending, orderWire, peekTrending } from './trending'

function stubFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('loadTrending', () => {
  it('reads items with their times and the generated stamp', async () => {
    stubFetch({
      topics: ['A', 'B'],
      items: [
        { topic: 'A', published_at: '2026-10-21T09:28:00+00:00' },
        { topic: 'B', published_at: null },
      ],
      generated_at: '2026-10-21T09:42:00+00:00',
    })
    expect(await loadTrending()).toEqual({
      items: [
        { topic: 'A', publishedAt: '2026-10-21T09:28:00+00:00' },
        { topic: 'B', publishedAt: null },
      ],
      generatedAt: '2026-10-21T09:42:00+00:00',
    })
  })

  it('falls back to topics with no times when items is missing', async () => {
    stubFetch({ topics: ['A'], generated_at: '2026-10-21T09:42:00+00:00' })
    expect(await loadTrending()).toEqual({
      items: [{ topic: 'A', publishedAt: null }],
      generatedAt: '2026-10-21T09:42:00+00:00',
    })
  })

  it('drops malformed items', async () => {
    stubFetch({ items: [{ topic: '' }, { topic: 3 }, null, { topic: 'Ok', published_at: 7 }] })
    expect((await loadTrending()).items).toEqual([{ topic: 'Ok', publishedAt: null }])
  })

  it('returns no items on a failed or non-ok response', async () => {
    stubFetch({ topics: ['A'] }, false)
    expect(await loadTrending()).toEqual({ items: [], generatedAt: null })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await loadTrending()).toEqual({ items: [], generatedAt: null })
  })

  it('caches under atlasTrendingV2 and reuses it for 30 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
    const fetchFn = stubFetch({ topics: ['A'], generated_at: 'g' })
    const first = await loadTrending()
    expect(TRENDING_CACHE_KEY).toBe('atlasTrendingV2')
    expect(window.sessionStorage.getItem('atlasTrendingV2')).not.toBeNull()

    vi.setSystemTime(new Date('2026-10-21T10:29:00Z'))
    expect(await loadTrending()).toEqual(first)
    expect(fetchFn).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-10-21T10:31:00Z'))
    await loadTrending()
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('ignores a V1 cache entry', async () => {
    window.sessionStorage.setItem('atlasTrendingV1', JSON.stringify({ topics: ['Old'], at: Date.now() }))
    const fetchFn = stubFetch({ topics: ['New'] })
    expect((await loadTrending()).items).toEqual([{ topic: 'New', publishedAt: null }])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})

describe('peekTrending', () => {
  it('returns a fresh session entry without fetching', () => {
    const fetchFn = stubFetch({ topics: ['X'] })
    window.sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ items: [{ topic: 'A', publishedAt: null }], generatedAt: 'g', at: Date.now() }))
    expect(peekTrending()).toEqual({ items: [{ topic: 'A', publishedAt: null }], generatedAt: 'g' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('is null for a stale entry, a V1 entry or nothing', () => {
    expect(peekTrending()).toBeNull()
    window.sessionStorage.setItem('atlasTrendingV1', JSON.stringify({ topics: ['Old'], at: Date.now() }))
    expect(peekTrending()).toBeNull()
    window.sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ items: [{ topic: 'A', publishedAt: null }], generatedAt: 'g', at: Date.now() - 31 * 60_000 }))
    expect(peekTrending()).toBeNull()
  })
})

describe('orderWire', () => {
  it('orders the wire newest first, undated last in model order', () => {
    const input = [
      { topic: 'u1', publishedAt: null },
      { topic: 't08', publishedAt: '2026-10-21T08:41:00+00:00' },
      { topic: 'u2', publishedAt: null },
      { topic: 't09', publishedAt: '2026-10-21T09:28:00+00:00' },
    ]
    const copy = structuredClone(input)
    expect(orderWire(input).map((i) => i.topic)).toEqual(['t09', 't08', 'u1', 'u2'])
    expect(input).toEqual(copy)
  })
})
