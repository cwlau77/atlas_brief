import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ToastItem } from '../components/Toast'
import type { SavedBriefing } from '../lib/normalize'
import { fileInto } from '../lib/archive'
import { KEYS, loadJSON, removeKeys, saveJSON } from '../lib/storage'
import { AppStateContext, type AppStateValue } from './context'
import { isSavedBriefing } from './resolveBriefing'
import { parseProfile, parseSettings, type UserProfile, type UserSettings } from './settings'

const SESSION_KEY = 'atlasSessionBriefing'
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

/** Writes `value` to localStorage whenever it changes after load; `onFail` runs when the write fails. */
function usePersist(key: string, value: unknown, onFail: () => void): void {
  const written = useRef(value)
  useEffect(() => {
    if (value === written.current) return
    written.current = value
    if (!saveJSON(key, value)) onFail()
  }, [key, value, onFail])
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
  // One toast per burst: saved and starred persist separately and can fail together.
  const lastFailure = useRef(0)
  const storageFailed = useCallback(() => {
    const now = Date.now()
    if (now - lastFailure.current < 1000) return
    lastFailure.current = now
    pushToast("Couldn't save in this browser. Storage is full or turned off.", 'error', 4000)
  }, [pushToast])

  usePersist(KEYS.saved, saved, storageFailed)
  usePersist(KEYS.starred, starred, storageFailed)
  usePersist(KEYS.settings, settings, storageFailed)

  // Read inside the setSaved updater so it stays pure while trimming prefers unstarred briefings.
  const starredRef = useRef(starred)
  useEffect(() => {
    starredRef.current = starred
  }, [starred])

  // Set inside the updater (idempotent under StrictMode), announced once the state lands.
  const notFiled = useRef<string | null>(null)
  const fileBriefing = useCallback((briefing: SavedBriefing) => {
    setSaved((prev) => {
      const next = fileInto(prev, briefing, starredRef.current)
      if (!next.includes(briefing)) notFiled.current = briefing.id
      return next
    })
  }, [])
  useEffect(() => {
    if (!notFiled.current) return
    notFiled.current = null
    pushToast('This briefing was not saved to the archive: every older one it could replace is starred. Unstar one to make room.', 'info', 6000)
  }, [saved, pushToast])

  const clearArchive = useCallback(() => {
    const ok = removeKeys([KEYS.saved, KEYS.starred])
    setSaved([])
    setStarred([])
    return ok
  }, [])

  const removeBriefing = useCallback((id: string) => {
    setSaved((prev) => prev.filter((b) => b.id !== id))
    setStarred((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : prev))
  }, [])

  const toggleStar = useCallback((id: string) => {
    setStarred((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]))
  }, [])

  const setSession = useCallback((briefing: SavedBriefing) => {
    setSessionState(briefing)
    storeSession(briefing)
  }, [])

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const saveProfile = useCallback((next: UserProfile) => {
    setProfile(next)
    const ok = saveJSON(KEYS.profile, next)
    if (!ok) storageFailed()
    return ok
  }, [storageFailed])

  const value = useMemo<AppStateValue>(() => ({
    saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, clearArchive, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast,
  }), [saved, starred, session, settings, profile, toasts,
    fileBriefing, removeBriefing, clearArchive, toggleStar, setSession, updateSettings, saveProfile, pushToast, dismissToast])

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
