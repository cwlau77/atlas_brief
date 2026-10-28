// The Hotspots snapshot from GET /api/hotspots, normalised to camelCase and kept in
// localStorage so the page can paint at once. Staleness is the caller's call (isStale).
export type Tier = 'quiet' | 'active' | 'elevated' | 'high'

export interface HotspotStory {
  headline: string
  blurb: string | null
  url: string
  outlet: string
  publishedAt: string
  image: { url: string; credit: string } | null
}

export interface HotspotCountry {
  iso2: string
  isoNumeric: string
  name: string
  n: number
  tier: Tier
  hourly: number[]
  with: string[]
  story: HotspotStory | null
}

export interface HotspotSnapshot {
  generatedAt: string
  coverageHours: number
  totalArticles: number
  feeds: number
  cutoffs: { active: number; elevated: number; high: number }
  countries: HotspotCountry[]
}

export const HOTSPOTS_CACHE_KEY = 'atlasHotspotsV1'
const STALE_MS = 60 * 60_000
const TIERS: readonly string[] = ['quiet', 'active', 'elevated', 'high']

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function normalizeStory(raw: unknown): HotspotStory | null {
  if (!isRec(raw) || !str(raw.headline)) return null
  const a = raw.article
  if (!isRec(a) || !str(a.url) || !str(a.outlet) || !str(a.published_at)) return null
  const img = raw.image
  const image = isRec(img) && str(img.url) && str(img.credit) ? { url: img.url, credit: img.credit } : null
  return {
    headline: raw.headline,
    blurb: str(raw.blurb) ? raw.blurb : null,
    url: a.url,
    outlet: a.outlet,
    publishedAt: a.published_at,
    image,
  }
}

function normalizeCountry(raw: unknown): HotspotCountry | null {
  if (!isRec(raw)) return null
  if (!str(raw.iso2) || !str(raw.iso_numeric) || !str(raw.name) || !num(raw.n)) return null
  if (!str(raw.tier) || !TIERS.includes(raw.tier)) return null
  return {
    iso2: raw.iso2,
    isoNumeric: raw.iso_numeric,
    name: raw.name,
    n: raw.n,
    tier: raw.tier as Tier,
    hourly: Array.isArray(raw.hourly) ? raw.hourly.filter(num) : [],
    with: Array.isArray(raw.with) ? raw.with.filter(str) : [],
    story: normalizeStory(raw.story),
  }
}

/** The API body as a snapshot, dropping malformed countries; null when it isn't a snapshot. */
export function normalizeSnapshot(body: unknown): HotspotSnapshot | null {
  if (!isRec(body)) return null
  const c = body.cutoffs
  if (!str(body.generated_at) || !num(body.coverage_hours) || !num(body.total_articles) || !num(body.feeds)) return null
  if (!isRec(c) || !num(c.active) || !num(c.elevated) || !num(c.high)) return null
  if (!Array.isArray(body.countries)) return null
  return {
    generatedAt: body.generated_at,
    coverageHours: body.coverage_hours,
    totalArticles: body.total_articles,
    feeds: body.feeds,
    cutoffs: { active: c.active, elevated: c.elevated, high: c.high },
    countries: body.countries.map(normalizeCountry).filter((x): x is HotspotCountry => x !== null),
  }
}

// The cache holds the normalised shape, so it passes back through the same checks.
function toWire(s: HotspotSnapshot): Rec {
  return {
    generated_at: s.generatedAt,
    coverage_hours: s.coverageHours,
    total_articles: s.totalArticles,
    feeds: s.feeds,
    cutoffs: s.cutoffs,
    countries: s.countries.map((k) => ({
      iso2: k.iso2,
      iso_numeric: k.isoNumeric,
      name: k.name,
      n: k.n,
      tier: k.tier,
      hourly: k.hourly,
      with: k.with,
      story: k.story && {
        headline: k.story.headline,
        blurb: k.story.blurb,
        article: { url: k.story.url, outlet: k.story.outlet, published_at: k.story.publishedAt },
        image: k.story.image,
      },
    })),
  }
}

/** The last snapshot saved on this device, or null when there is none or it can't be read. */
export function readCachedSnapshot(): HotspotSnapshot | null {
  try {
    const raw = window.localStorage.getItem(HOTSPOTS_CACHE_KEY)
    return raw ? normalizeSnapshot(toWire(JSON.parse(raw) as HotspotSnapshot)) : null
  } catch {
    return null
  }
}

/** Fetches a fresh snapshot and caches it. Throws on a non-OK reply (503 = unavailable), timeout or bad body. */
export async function fetchSnapshot(signal?: AbortSignal, timeoutMs = 60_000): Promise<HotspotSnapshot> {
  const ctl = new AbortController()
  const onAbort = () => ctl.abort()
  if (signal?.aborted) ctl.abort()
  signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch('/api/hotspots', { signal: ctl.signal })
    if (!res.ok) throw new Error(`Hotspots unavailable (${res.status})`)
    const snapshot = normalizeSnapshot(await res.json())
    if (!snapshot) throw new Error('Hotspots reply was malformed')
    try {
      window.localStorage.setItem(HOTSPOTS_CACHE_KEY, JSON.stringify(snapshot))
    } catch {
      // the cache is a convenience
    }
    return snapshot
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function isStale(s: HotspotSnapshot, now: Date): boolean {
  const at = Date.parse(s.generatedAt)
  return Number.isNaN(at) || now.getTime() - at > STALE_MS
}

export function isPartial(s: HotspotSnapshot): boolean {
  return s.feeds < 5 || s.totalArticles < 100
}
