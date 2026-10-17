import type { SavedBriefing } from '../lib/normalize'

export function findBriefing(
  id: string | undefined,
  session: SavedBriefing | null,
  saved: SavedBriefing[],
): SavedBriefing | null {
  if (!id) return null
  if (session?.id === id) return session
  return saved.find((b) => b.id === id) ?? null
}

/** The briefing the nav's "Briefing" link opens: this session's, else the newest saved. */
export function latestBriefingId(session: SavedBriefing | null, saved: SavedBriefing[]): string | null {
  return session?.id ?? saved[0]?.id ?? null
}

/** Minimal shape check for briefings read back from storage. */
export function isSavedBriefing(value: unknown): value is SavedBriefing {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.area === 'string' && Array.isArray(v.keyDevelopments)
}
