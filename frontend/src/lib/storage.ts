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

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** What this browser holds; `bytes` approximates UTF-16 storage of the four keys. */
export function storageSummary(): { briefings: number; starred: number; bytes: number } {
  const count = (key: string) => {
    const v = loadJSON<unknown>(key, [])
    return Array.isArray(v) ? v.length : 0
  }
  const bytes = Object.values(KEYS).reduce((n, key) => n + (readRaw(key)?.length ?? 0) * 2, 0)
  return { briefings: count(KEYS.saved), starred: count(KEYS.starred), bytes }
}

/** Everything Atlas stores, as one downloadable JSON document. */
export function exportBlob(): Blob {
  const data = {
    exportedAt: new Date().toISOString(),
    saved: loadJSON<unknown>(KEYS.saved, []),
    starred: loadJSON<unknown>(KEYS.starred, []),
    settings: loadJSON<unknown>(KEYS.settings, {}),
    profile: loadJSON<unknown>(KEYS.profile, {}),
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}
