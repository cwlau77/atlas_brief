// Home's "On the wire" topics from GET /api/trending, cached for the session so
// returning to Home doesn't refetch. Any failure reads as "no topics".
export const TRENDING_CACHE_KEY = 'atlasTrendingV2'
const CACHE_MS = 30 * 60_000

export type TrendingItem = { topic: string; publishedAt: string | null }
export type TrendingResult = { items: TrendingItem[]; generatedAt: string | null }

const EMPTY: TrendingResult = { items: [], generatedAt: null }

function cleanItems(value: unknown): TrendingItem[] {
  if (!Array.isArray(value)) return []
  const out: TrendingItem[] = []
  for (const raw of value) {
    const item = raw as { topic?: unknown; publishedAt?: unknown; published_at?: unknown } | null
    if (!item || typeof item.topic !== 'string' || item.topic.trim() === '') continue
    const at = item.publishedAt ?? item.published_at
    out.push({ topic: item.topic, publishedAt: typeof at === 'string' ? at : null })
  }
  return out
}

// An older backend sends only `topics`; those carry no times.
function fromBody(body: { items?: unknown; topics?: unknown } | null): TrendingItem[] {
  const items = cleanItems(body?.items)
  if (items.length) return items
  return cleanItems(Array.isArray(body?.topics) ? body.topics.map((topic) => ({ topic })) : [])
}

function readCache(): TrendingResult | null {
  try {
    const raw = window.sessionStorage.getItem(TRENDING_CACHE_KEY)
    const cached = raw ? (JSON.parse(raw) as { items?: unknown; generatedAt?: unknown; at?: unknown }) : null
    if (!cached || typeof cached.at !== 'number' || Date.now() - cached.at > CACHE_MS) return null
    const items = cleanItems(cached.items)
    if (!items.length) return null
    return { items, generatedAt: typeof cached.generatedAt === 'string' ? cached.generatedAt : null }
  } catch {
    return null
  }
}

/** The fresh session copy, read synchronously, or null when there isn't one. */
export function peekTrending(): TrendingResult | null {
  return readCache()
}

/** Wire items, or an empty result when the backend is asleep, has no model key, or fails. */
export async function loadTrending(signal?: AbortSignal): Promise<TrendingResult> {
  const cached = readCache()
  if (cached) return cached
  try {
    const res = await fetch('/api/trending', { signal })
    if (!res.ok) return EMPTY
    const body = await res.json()
    const items = fromBody(body)
    if (!items.length) return EMPTY
    const generatedAt = typeof body?.generated_at === 'string' ? body.generated_at : null
    try {
      window.sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ items, generatedAt, at: Date.now() }))
    } catch {
      // the cache is a convenience
    }
    return { items, generatedAt }
  } catch {
    return EMPTY
  }
}

/** Dated items newest first, then undated ones in their original order. */
export function orderWire(items: TrendingItem[]): TrendingItem[] {
  const time = (i: TrendingItem) => (i.publishedAt ? Date.parse(i.publishedAt) : NaN)
  const dated = items.filter((i) => !Number.isNaN(time(i))).sort((a, b) => time(b) - time(a))
  const undated = items.filter((i) => Number.isNaN(time(i)))
  return [...dated, ...undated]
}
