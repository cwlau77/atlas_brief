// Archive filing policy and topic threads. Pure functions; AppState and the
// Archive page call them.
import type { SavedBriefing } from './normalize'

export const PER_TOPIC_LIMIT = 4
export const ARCHIVE_LIMIT = 24

export function topicKey(area: string): string {
  return area.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Older first: by generatedAt, falling back to list position (later = older) for unparseable dates. */
function oldestFirst(list: SavedBriefing[], all: SavedBriefing[]): SavedBriefing[] {
  const age = (b: SavedBriefing) => {
    const t = Date.parse(b.generatedAt)
    return Number.isNaN(t) ? -Infinity : t
  }
  return [...list].sort((a, b) => age(a) - age(b) || all.indexOf(b) - all.indexOf(a))
}

/**
 * Files `briefing` newest first, then enforces the per-topic cap and the total cap by dropping
 * the oldest unstarred briefing. Starred briefings are never dropped: when only starred ones
 * could make room, the new briefing is not archived and `saved` comes back unchanged (as a new array).
 */
export function fileInto(saved: SavedBriefing[], briefing: SavedBriefing, starred: string[]): SavedBriefing[] {
  let next = [briefing, ...saved.filter((b) => b.id !== briefing.id)]
  const key = topicKey(briefing.area)
  const sameTopic = (b: SavedBriefing) => topicKey(b.area) === key
  const makeRoom = (pool: (b: SavedBriefing) => boolean): boolean => {
    const victim = oldestFirst(next.filter((b) => b !== briefing && pool(b) && !starred.includes(b.id)), next)[0]
    if (!victim) return false
    next = next.filter((b) => b !== victim)
    return true
  }
  while (next.filter(sameTopic).length > PER_TOPIC_LIMIT) if (!makeRoom(sameTopic)) return [...saved]
  while (next.length > ARCHIVE_LIMIT) if (!makeRoom(() => true)) return [...saved]
  return next
}

export interface TopicThread {
  key: string
  area: string
  briefings: SavedBriefing[]
}

/** One thread per topic, briefings oldest to newest; threads ordered by their newest briefing. */
export function groupThreads(saved: SavedBriefing[]): TopicThread[] {
  const map = new Map<string, SavedBriefing[]>()
  for (const b of saved) map.set(topicKey(b.area), [...(map.get(topicKey(b.area)) ?? []), b])
  const threads = [...map].map(([key, list]) => {
    const briefings = oldestFirst(list, saved)
    return { key, area: briefings[briefings.length - 1].area, briefings }
  })
  const newest = (t: TopicThread) => saved.indexOf(t.briefings[t.briefings.length - 1])
  return threads.sort((a, b) => newest(a) - newest(b))
}

export function hasHighAlert(b: SavedBriefing): boolean {
  return b.alerts.some((a) => a.type === 'urgent' || a.type === 'warning')
}
