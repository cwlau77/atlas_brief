// Signals tab math. The summary sentence is a template over the data; no model call.
import type { SavedBriefing } from './normalize'

export const SOURCE_LABELS: Record<string, string> = {
  newsapi: 'NewsAPI',
  gdelt: 'GDELT',
  rss: 'Wire feeds',
}

export interface Share {
  key: string
  label: string
  count: number
  pct: number
}

export function shares(record: Record<string, number>, labels: Record<string, string> = {}): Share[] {
  const items = Object.entries(record)
    .filter(([, v]) => v > 0)
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }))
    .sort((a, z) => z.count - a.count || a.label.localeCompare(z.label))
  const total = items.reduce((t, x) => t + x.count, 0)
  if (!total) return []
  // Largest-remainder rounding so the integer percentages sum to exactly 100.
  const raw = items.map((x) => (x.count / total) * 100)
  const floors = raw.map(Math.floor)
  let remaining = 100 - floors.reduce((t, x) => t + x, 0)
  const byRemainder = raw.map((r, i) => ({ i, rem: r - floors[i] })).sort((a, z) => z.rem - a.rem || a.i - z.i)
  for (const { i } of byRemainder) {
    if (remaining <= 0) break
    floors[i] += 1
    remaining -= 1
  }
  return items.map((x, i) => ({ ...x, pct: floors[i] }))
}

export function topEntries(record: Record<string, number>, n: number): [string, number][] {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
    .slice(0, n)
}

export function summarizeSignals(b: Pick<SavedBriefing, 'regionCounts' | 'sourceBreakdown'>): string {
  const regions = shares(b.regionCounts)
  const sources = shares(b.sourceBreakdown, SOURCE_LABELS)
  const topRegion = regions[0]
  const topSource = sources[0]
  if (regions.length === 1 && !topSource) return `Every regional mention in this briefing is of ${topRegion.label}.`
  if (topRegion && topSource) {
    const regionPart = regions.length === 1
      ? `Every regional mention is of ${topRegion.label}`
      : `Coverage is concentrated on ${topRegion.label}, with ${topRegion.pct}% of regional mentions`
    return `${regionPart}, and ${topSource.label} supplied ${topSource.pct}% of articles.`
  }
  if (topRegion) return `Coverage is concentrated on ${topRegion.label}, with ${topRegion.pct}% of regional mentions.`
  if (topSource) {
    const total = sources.reduce((t, x) => t + x.count, 0)
    return `${topSource.label} supplied ${topSource.pct}% of the ${total} articles.`
  }
  return 'This briefing has no regional or source data to summarize.'
}
