// Home's "Trending now" topics from GET /api/trending, cached for the session so
// returning to Home doesn't refetch. Any failure reads as "no topics".
export const TRENDING_CACHE_KEY = 'atlasTrendingV1'
const CACHE_MS = 30 * 60_000

function clean(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : []
}

function readCache(): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(TRENDING_CACHE_KEY)
    const cached = raw ? (JSON.parse(raw) as { topics?: unknown; at?: unknown }) : null
    if (!cached || typeof cached.at !== 'number' || Date.now() - cached.at > CACHE_MS) return null
    const topics = clean(cached.topics)
    return topics.length ? topics : null
  } catch {
    return null
  }
}

/** Trending topics, or [] when the backend is asleep, has no model key, or fails. */
export async function loadTrending(signal?: AbortSignal): Promise<string[]> {
  const cached = readCache()
  if (cached) return cached
  try {
    const res = await fetch('/api/trending', { signal })
    if (!res.ok) return []
    const topics = clean((await res.json())?.topics)
    if (topics.length) {
      try {
        window.sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ topics, at: Date.now() }))
      } catch {
        // the cache is a convenience
      }
    }
    return topics
  } catch {
    return []
  }
}
