// Guarded localStorage access. Keys are inherited verbatim from the legacy
// single-file app so existing users' saved briefings survive the migration.

export const KEYS = {
  saved: 'savedBriefingsV2',
  starred: 'starredBriefings',
  profile: 'userProfileV1',
  settings: 'userSettingsV1',
} as const

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return fallback
    return (JSON.parse(raw) as T) ?? fallback
  } catch {
    // Corrupted entry or storage disabled — the legacy app crashed on load here.
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false // quota exceeded or storage disabled — callers degrade gracefully
  }
}
