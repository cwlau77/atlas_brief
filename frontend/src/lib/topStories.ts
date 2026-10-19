import type { ViewDevelopment } from './normalize'

const RANK: Record<ViewDevelopment['priority'], number> = { high: 0, medium: 1, low: 2 }

function time(d: ViewDevelopment): number {
  const t = Date.parse(d.timestamp)
  return Number.isNaN(t) ? 0 : t
}

/** Development indexes for the Top stories strip: priority, then newest. Empty below two stories. */
export function topStories(devs: ViewDevelopment[], limit = 5): number[] {
  if (devs.length < 2) return []
  return devs
    .map((_, i) => i)
    .sort((a, b) => RANK[devs[a].priority] - RANK[devs[b].priority] || time(devs[b]) - time(devs[a]) || a - b)
    .slice(0, limit)
}
