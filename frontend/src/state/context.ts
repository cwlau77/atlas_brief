import { createContext } from 'react'
import type { ToastItem } from '../components/Toast'
import type { SavedBriefing } from '../lib/normalize'
import type { UserProfile, UserSettings } from './settings'

export interface AppStateValue {
  saved: SavedBriefing[]
  starred: string[]
  session: SavedBriefing | null
  settings: UserSettings
  profile: UserProfile
  toasts: ToastItem[]
  fileBriefing: (briefing: SavedBriefing) => void
  removeBriefing: (id: string) => void
  /** Removes several briefings (and their stars) in one write. */
  removeBriefings: (ids: string[]) => void
  /** Empties saved and starred; false when storage could not be cleared (the in-memory archive is still emptied). */
  clearArchive: () => boolean
  toggleStar: (id: string) => void
  /** Stars (on) or unstars every id in one write. */
  setStars: (ids: string[], on: boolean) => void
  setSession: (briefing: SavedBriefing) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  saveProfile: (profile: UserProfile) => boolean
  pushToast: (message: string, tone?: ToastItem['tone'], ttl?: number) => void
  dismissToast: (id: number) => void
}

export const AppStateContext = createContext<AppStateValue | null>(null)
