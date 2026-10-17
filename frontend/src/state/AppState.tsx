import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { ToastItem } from '../components/Toast'
import type { SavedBriefing } from '../lib/normalize'
import { KEYS, loadJSON, saveJSON } from '../lib/storage'
import { AppStateContext, type AppStateValue } from './context'
import { isSavedBriefing } from './resolveBriefing'
import { parseProfile, parseSettings, type UserProfile, type UserSettings } from './settings'

const SESSION_KEY = 'atlasSessionBriefing'
const ARCHIVE_LIMIT = 12
let toastSeq = 0

function loadSession(): SavedBriefing | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    return isSavedBriefing(value) ? value : null
  } catch {
    return null
  }
}

function storeSession(briefing: SavedBriefing): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(briefing))
  } catch {
    // session copy is a convenience; the in-memory state still works
  }
}

function loadSaved(): SavedBriefing[] {
  const value = loadJSON<unknown>(KEYS.saved, [])
  return Array.isArray(value) ? value.filter(isSavedBriefing) : []
}

function loadStarred(): string[] {
  const value = loadJSON<unknown>(KEYS.starred, [])
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedBriefing[]>(loadSaved)
  const [starred, setStarred] = useState<string[]>(loadStarred)
  const [session, setSessionState] = useState<SavedBriefing | null>(loadSession)
  const [settings, setSettings] = useState<UserSettings>(() => parseSettings(loadJSON<unknown>(KEYS.settings, null)))
  const [profile, setProfile] = useState<UserProfile>(() => parseProfile(loadJSON<unknown>(KEYS.profile, null)))
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const pushToast = useCallback((message: string, tone: ToastItem['tone'] = 'info', ttl = 3000) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl)
  }, [])
  const storageFailed = useCallback(
    () => pushToast("Couldn't save in this browser. Storage is full or turned off.", 'error', 4000),
    [pushToast],
  )

  const fileBriefing = useCallback((briefing: SavedBriefing) => {
    // Replace any same-topic entry, newest first, keep twelve (legacy behavior).
    setSaved((prev) => {
      const next = [briefing, ...prev.filter((b) => b.area !== briefing.area)].slice(0, ARCHIVE_LIMIT)
      if (!saveJSON(KEYS.saved, next)) storageFailed()
      return next
    })
  }, [storageFailed])

  const removeBriefing = useCallback((id: string) => {
    let failed = false
    setSaved((prev) => {
      const next = prev.filter((b) => b.id !== id)
      if (!saveJSON(KEYS.saved, next)) failed = true
      return next
    })
    setStarred((prev) => {
      const next = prev.filter((s) => s !== id)
      if (!saveJSON(KEYS.starred, next)) failed = true
      return next
    })
    if (failed) storageFailed()
  }, [storageFailed])

  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
      if (!saveJSON(KEYS.starred, next)) storageFailed()
      return next
    })
  }, [storageFailed])

  const setSession = useCallback((briefing: SavedBriefing) => {
    setSessionState(briefing)
    storeSession(briefing)
  }, [])

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (!saveJSON(KEYS.settings, next)) storageFailed()
      return next
    })
  }, [storageFailed])

  const saveProfile = useCallback((next: UserProfile) => {
    setProfile(next)
    const ok = saveJSON(KEYS.profile, next)
    if (!ok) storageFailed()
    return ok
  }, [storageFailed])

  const value = useMemo<AppStateValue>(() => ({
    saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast,
  }), [saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
