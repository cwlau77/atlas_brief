import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { KEYS, loadJSON, saveJSON } from '../lib/storage'
import './profile.css'

export interface UserProfile {
  firstName: string
  lastName: string
  emailAddress: string
  fieldOfStudy: string
}

export interface UserSettings {
  compactMode: boolean
  autoSave: boolean
  showHistoricalContext: boolean
}

const EMPTY_PROFILE: UserProfile = { firstName: '', lastName: '', emailAddress: '', fieldOfStudy: '' }
const DEFAULT_SETTINGS: UserSettings = { compactMode: false, autoSave: true, showHistoricalContext: true }

export function loadProfile(): UserProfile {
  return { ...EMPTY_PROFILE, ...loadJSON<Partial<UserProfile>>(KEYS.profile, {}) }
}

export function loadSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS, ...loadJSON<Partial<UserSettings>>(KEYS.settings, {}) }
}

function initialsFor(profile: UserProfile): string {
  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase()
  return initials || 'AB'
}

const SETTING_LABELS: { key: keyof UserSettings; label: string; hint: string }[] = [
  { key: 'autoSave', label: 'Auto-file briefings', hint: 'File each generated briefing in the archive automatically.' },
  { key: 'showHistoricalContext', label: 'Historical context', hint: 'Show the "from the archive" background paragraphs.' },
  { key: 'compactMode', label: 'Compact layout', hint: 'Tighter spacing across briefing sections.' },
]

export function ProfilePage({ onStorageFailure }: { onStorageFailure: () => void }) {
  const [profile, setProfile] = useState<UserProfile>(loadProfile)
  const [settings, setSettings] = useState<UserSettings>(loadSettings)
  const [savedFlash, setSavedFlash] = useState(false)

  const updateField = (key: keyof UserProfile) => (e: ChangeEvent<HTMLInputElement>) => {
    setProfile((p) => ({ ...p, [key]: e.target.value }))
  }

  const persistProfile = () => {
    if (!saveJSON(KEYS.profile, profile)) onStorageFailure()
    else {
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1600)
    }
  }

  const toggleSetting = (key: keyof UserSettings) => {
    const next = { ...settings, [key]: !settings[key] }
    setSettings(next)
    if (!saveJSON(KEYS.settings, next)) onStorageFailure()
  }

  return (
    <div className="profile-page">
      <section className="card profile-card">
        <div className="plate-label">Analyst profile</div>
        <div className="profile-row">
          <div className="profile-avatar mono" aria-hidden>{initialsFor(profile)}</div>
          <div className="profile-name-block">
            <span className="profile-display-name">
              {`${profile.firstName} ${profile.lastName}`.trim() || 'Unnamed analyst'}
            </span>
            <span className="profile-display-email mono">{profile.emailAddress || 'no contact filed'}</span>
          </div>
        </div>
        <div className="profile-fields">
          <label>First name
            <input type="text" value={profile.firstName} onChange={updateField('firstName')} autoComplete="given-name" />
          </label>
          <label>Last name
            <input type="text" value={profile.lastName} onChange={updateField('lastName')} autoComplete="family-name" />
          </label>
          <label>Email
            <input type="email" value={profile.emailAddress} onChange={updateField('emailAddress')} autoComplete="email" />
          </label>
          <label>Field of study
            <input type="text" value={profile.fieldOfStudy} onChange={updateField('fieldOfStudy')} placeholder="e.g. International Relations" />
          </label>
        </div>
        <button className="btn btn-primary" onClick={persistProfile}>
          {savedFlash ? 'Filed ✓' : 'Save profile'}
        </button>
        <p className="profile-note mono">Stored only in this browser — nothing leaves your device.</p>
      </section>

      <section className="card profile-card">
        <div className="plate-label">Preferences</div>
        <ul className="settings-list">
          {SETTING_LABELS.map(({ key, label, hint }) => (
            <li key={key} className="settings-item">
              <div>
                <span className="settings-label">{label}</span>
                <span className="settings-hint">{hint}</span>
              </div>
              <button
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                className={`switch ${settings[key] ? 'on' : ''}`}
                onClick={() => toggleSetting(key)}
              >
                <span className="switch-knob" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
