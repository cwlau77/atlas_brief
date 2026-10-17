import { useState, type ChangeEvent } from 'react'
import { useAppState } from '../state/hooks'
import type { UserProfile, UserSettings } from '../state/settings'
import { TimeZonePicker } from '../components/TimeZonePicker'
import './settings.css'

type ToggleKey = Exclude<keyof UserSettings, 'timeZone'>

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'autoSave', label: 'Save briefings automatically', hint: 'Add each new briefing to your archive.' },
  { key: 'showHistoricalContext', label: 'Historical context', hint: 'Show the "from the archive" background paragraphs.' },
  { key: 'compactMode', label: 'Compact layout', hint: 'Tighter spacing across briefing pages.' },
]

function initialsFor(p: UserProfile): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || 'AB'
}

export function SettingsPage() {
  const { profile, saveProfile, settings, updateSettings } = useAppState()
  const [draft, setDraft] = useState<UserProfile>(profile)
  const [savedFlash, setSavedFlash] = useState(false)

  const field = (key: keyof UserProfile) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((p) => ({ ...p, [key]: e.target.value }))
  const persist = () => {
    if (saveProfile(draft)) {
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
    }
  }

  return (
    <div className="page wrap settings">
      <header className="page-head">
        <p className="page-kicker label">Settings</p>
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="settings-card" aria-labelledby="profile-h">
        <h2 id="profile-h" className="label">Analyst profile</h2>
        <div className="profile-row">
          <div className="profile-avatar mono" aria-hidden="true">{initialsFor(draft)}</div>
          <div className="profile-name-block">
            <span className="profile-display-name">{`${draft.firstName} ${draft.lastName}`.trim() || 'Unnamed analyst'}</span>
            <span className="profile-display-email mono">{draft.emailAddress || 'No email saved'}</span>
          </div>
        </div>
        <div className="profile-fields">
          <label>First name<input type="text" value={draft.firstName} onChange={field('firstName')} autoComplete="given-name" data-cursor="text" /></label>
          <label>Last name<input type="text" value={draft.lastName} onChange={field('lastName')} autoComplete="family-name" data-cursor="text" /></label>
          <label>Email<input type="email" value={draft.emailAddress} onChange={field('emailAddress')} autoComplete="email" data-cursor="text" /></label>
          <label>Field of study<input type="text" value={draft.fieldOfStudy} onChange={field('fieldOfStudy')} placeholder="e.g. International Relations" data-cursor="text" /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={persist} data-cursor="link">{savedFlash ? 'Saved' : 'Save profile'}</button>
        <p className="profile-note label">Stored only in this browser.</p>
      </section>

      <section className="settings-card" aria-labelledby="time-h">
        <h2 id="time-h" className="label">Time</h2>
        <TimeZonePicker value={settings.timeZone} onChange={(tz) => updateSettings({ timeZone: tz })} />
      </section>

      <section className="settings-card" aria-labelledby="prefs-h">
        <h2 id="prefs-h" className="label">Preferences</h2>
        <ul className="settings-list">
          {TOGGLES.map(({ key, label, hint }) => (
            <li key={key} className="settings-item">
              <div>
                <span className="settings-label">{label}</span>
                <span className="settings-hint">{hint}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings[key]}
                aria-label={label}
                className={`switch ${settings[key] ? 'on' : ''}`}
                onClick={() => updateSettings({ [key]: !settings[key] } as Partial<UserSettings>)}
                data-cursor="link"
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
