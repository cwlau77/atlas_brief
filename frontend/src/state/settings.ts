// Persisted user settings and profile. Parsing is defensive: storage may hold
// entries from older app versions or be hand-edited.
import { AUTO_ZONE, isValidTimeZone } from '../lib/time'

export interface UserSettings {
  /** 'auto' follows the device; otherwise an IANA zone such as 'America/New_York'. */
  timeZone: string
  autoSave: boolean
  showHistoricalContext: boolean
  compactMode: boolean
}

export const DEFAULT_SETTINGS: UserSettings = {
  timeZone: AUTO_ZONE,
  autoSave: true,
  showHistoricalContext: true,
  compactMode: false,
}

export interface UserProfile {
  firstName: string
  lastName: string
  emailAddress: string
  fieldOfStudy: string
}

export const EMPTY_PROFILE: UserProfile = { firstName: '', lastName: '', emailAddress: '', fieldOfStudy: '' }

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

export function parseSettings(raw: unknown): UserSettings {
  const r = asRecord(raw)
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  const tz = typeof r.timeZone === 'string' && (r.timeZone === AUTO_ZONE || isValidTimeZone(r.timeZone))
    ? r.timeZone
    : AUTO_ZONE
  return {
    timeZone: tz,
    autoSave: bool(r.autoSave, DEFAULT_SETTINGS.autoSave),
    showHistoricalContext: bool(r.showHistoricalContext, DEFAULT_SETTINGS.showHistoricalContext),
    compactMode: bool(r.compactMode, DEFAULT_SETTINGS.compactMode),
  }
}

export function parseProfile(raw: unknown): UserProfile {
  const r = asRecord(raw)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    firstName: str(r.firstName),
    lastName: str(r.lastName),
    emailAddress: str(r.emailAddress),
    fieldOfStudy: str(r.fieldOfStudy),
  }
}
