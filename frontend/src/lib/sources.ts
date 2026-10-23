// What Atlas reads, from GET /api/sources, cached for the session so Home's lede,
// provenance row and "How Atlas reads" section share one value. Any failure reads as null.
import { useEffect, useState } from 'react'

export type SourceService = { name: string; label: string; enabled: boolean; financeOnly: boolean }
export type SourcesInfo = { services: SourceService[]; feeds: { count: number; outlets: string[] } }

export const SOURCES_CACHE_KEY = 'atlasSourcesV1'
const CACHE_MS = 30 * 60_000

/** Fallback names, in registry order, for when /sources fails. */
export const STATIC_SERVICE_LABELS: string[] = [
  'NewsAPI', 'GDELT 2.0', 'Google News', 'The Guardian', 'GNews', 'NewsData.io',
  'Brave Search', 'Tavily', 'Exa', 'Finnhub', 'Marketaux', 'Alpha Vantage',
]

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** One to nine spelled out, 10 and up as digits. */
export function countWord(n: number): string {
  return n >= 1 && n <= 9 ? WORDS[n - 1] : String(n)
}

/** Enabled, non-finance services. The RSS bundle is not in `services`. */
export function liveServiceCount(info: SourcesInfo): number {
  return info.services.filter((s) => s.enabled && !s.financeOnly).length
}

function parse(body: unknown): SourcesInfo | null {
  const b = body as { services?: unknown; feeds?: { count?: unknown; outlets?: unknown } } | null
  if (!b || !Array.isArray(b.services) || !b.feeds || typeof b.feeds.count !== 'number') return null
  const services: SourceService[] = []
  for (const raw of b.services) {
    const s = raw as { name?: unknown; label?: unknown; enabled?: unknown; finance_only?: unknown; financeOnly?: unknown } | null
    if (!s || typeof s.name !== 'string' || typeof s.label !== 'string') return null
    services.push({
      name: s.name,
      label: s.label,
      enabled: s.enabled === true,
      financeOnly: (s.financeOnly ?? s.finance_only) === true,
    })
  }
  const outlets = Array.isArray(b.feeds.outlets) ? b.feeds.outlets.filter((o): o is string => typeof o === 'string') : []
  return { services, feeds: { count: b.feeds.count, outlets } }
}

function readCache(): SourcesInfo | null {
  try {
    const raw = window.sessionStorage.getItem(SOURCES_CACHE_KEY)
    const cached = raw ? (JSON.parse(raw) as { info?: unknown; at?: unknown }) : null
    if (!cached || typeof cached.at !== 'number' || Date.now() - cached.at > CACHE_MS) return null
    return parse(cached.info)
  } catch {
    return null
  }
}

/** The fresh session copy, read synchronously, or null when there isn't one. */
export function peekSources(): SourcesInfo | null {
  return readCache()
}

/** The sources, or null when the backend is asleep, too old to have /sources, or fails. */
export async function loadSources(signal?: AbortSignal): Promise<SourcesInfo | null> {
  const cached = readCache()
  if (cached) return cached
  try {
    const res = await fetch('/api/sources', { signal })
    if (!res.ok) return null
    const info = parse(await res.json())
    if (!info) return null
    try {
      window.sessionStorage.setItem(SOURCES_CACHE_KEY, JSON.stringify({ info, at: Date.now() }))
    } catch {
      // the cache is a convenience
    }
    return info
  } catch {
    return null
  }
}

/** The session copy on first render, then the loaded value. Null until known, and for good if it fails. */
export function useSources(): SourcesInfo | null {
  const [info, setInfo] = useState<SourcesInfo | null>(peekSources)
  useEffect(() => {
    const ctrl = new AbortController()
    void loadSources(ctrl.signal).then((next) => {
      if (!ctrl.signal.aborted && next) setInfo(next)
    })
    return () => ctrl.abort()
  }, [])
  return info
}
