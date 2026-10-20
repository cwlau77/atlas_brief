import { useEffect, useState, type ChangeEvent, type ComponentType } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ClearIcon, DataIcon, ExportIcon, ProfileIcon, ReadingIcon, TimeIcon, type IconProps } from '../components/icons'
import { TimeZonePicker } from '../components/TimeZonePicker'
import { plural } from '../lib/plural'
import { exportBlob, storageSummary } from '../lib/storage'
import { useAppState } from '../state/hooks'
import type { UserProfile, UserSettings } from '../state/settings'
import './settings.css'

type ToggleKey = Exclude<keyof UserSettings, 'timeZone'>

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: 'autoSave', label: 'Save briefings automatically', hint: 'Add each new briefing to your archive.' },
  { key: 'showHistoricalContext', label: 'Historical context', hint: 'Show the "From the archive" teaser on each development.' },
  { key: 'compactMode', label: 'Compact layout', hint: 'Tighter spacing across briefing pages.' },
]

const SECTIONS: { id: string; label: string; Icon: ComponentType<IconProps> }[] = [
  { id: 'profile', label: 'Profile', Icon: ProfileIcon },
  { id: 'time', label: 'Time', Icon: TimeIcon },
  { id: 'reading', label: 'Reading', Icon: ReadingIcon },
  { id: 'data', label: 'Your data', Icon: DataIcon },
]

function initialsFor(p: UserProfile): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || 'AB'
}

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Highlights the index entry for the section nearest the top of the viewport. */
function useSectionInView(ids: string[]): string {
  const [current, setCurrent] = useState(ids[0])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setCurrent(top.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [ids])
  return current
}

const SECTION_IDS = SECTIONS.map((s) => s.id)

export function SettingsPage() {
  const { profile, saveProfile, settings, updateSettings, saved, starred, clearArchive, pushToast } = useAppState()
  const [draft, setDraft] = useState<UserProfile>(profile)
  const [editing, setEditing] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const current = useSectionInView(SECTION_IDS)

  const field = (key: keyof UserProfile) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((p) => ({ ...p, [key]: e.target.value }))
  const persist = () => {
    if (saveProfile(draft)) {
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
    }
  }
  const download = () => {
    const url = URL.createObjectURL(exportBlob())
    const a = document.createElement('a')
    a.href = url
    a.download = 'atlas-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const clear = () => {
    setConfirmClear(false)
    // On failure the storage error toast from AppState already explains it.
    if (clearArchive()) pushToast('Archive cleared', 'info', 2400)
  }
  const name = `${profile.firstName} ${profile.lastName}`.trim() || 'Unnamed analyst'

  return (
    <div className="page wrap settings">
      <header className="page-head page-head-row">
        <h1 className="page-title">Settings</h1>
        <p className="page-meta label">Stored only in this browser</p>
      </header>

      <div className="settings-layout">
        <nav className="settings-index" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <a key={id} href={`#${id}`} className={current === id ? 'on' : ''} aria-current={current === id ? 'true' : undefined}>
              <Icon size={16} />{label}
            </a>
          ))}
        </nav>

        <div className="settings-sections">
          <section id="profile" className="settings-card" aria-labelledby="profile-h">
            <h2 id="profile-h" className="label">Profile</h2>
            <div className="profile-row">
              <div className="profile-avatar" aria-hidden="true">{initialsFor(profile)}</div>
              <div className="profile-name-block">
                <span className="profile-display-name">{name}</span>
                <span className="profile-display-meta">{profile.fieldOfStudy || 'No field of study'}{profile.emailAddress ? ` · ${profile.emailAddress}` : ''}</span>
              </div>
              <button type="button" className="btn btn-quiet profile-edit" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>
                {editing ? 'Close' : 'Edit profile'}
              </button>
            </div>
            {editing && (
              <>
                <div className="profile-fields">
                  <label>First name<input type="text" value={draft.firstName} onChange={field('firstName')} autoComplete="given-name" /></label>
                  <label>Last name<input type="text" value={draft.lastName} onChange={field('lastName')} autoComplete="family-name" /></label>
                  <label>Email<input type="email" value={draft.emailAddress} onChange={field('emailAddress')} autoComplete="email" /></label>
                  <label>Field of study<input type="text" value={draft.fieldOfStudy} onChange={field('fieldOfStudy')} placeholder="e.g. International Relations" /></label>
                </div>
                <button type="button" className="btn btn-primary" onClick={persist}>{savedFlash ? 'Saved' : 'Save profile'}</button>
              </>
            )}
          </section>

          <section id="time" className="settings-card" aria-labelledby="time-h">
            <h2 id="time-h" className="label">Time</h2>
            <TimeZonePicker value={settings.timeZone} onChange={(tz) => updateSettings({ timeZone: tz })} />
          </section>

          <section id="reading" className="settings-card" aria-labelledby="reading-h">
            <h2 id="reading-h" className="label">Reading</h2>
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
                  >
                    <span className="switch-knob" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section id="data" className="settings-card" aria-labelledby="data-h">
            <h2 id="data-h" className="label">Your data</h2>
            <div className="data-row">
              <p>
                {plural(saved.length, 'briefing')} · {starred.length} starred
                <span className="settings-hint">About {formatBytes(storageSummary().bytes)} in this browser. Nothing is sent to a server.</span>
              </p>
              <div className="data-actions">
                <button type="button" className="btn btn-quiet" onClick={download}><ExportIcon size={15} />Export</button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(true)} disabled={!saved.length && !starred.length}><ClearIcon size={15} />Clear archive</button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Clear the archive?"
        body={`${plural(saved.length, 'saved briefing')} and ${starred.length} star${starred.length === 1 ? '' : 's'} will be removed from this browser. Settings and your profile stay.`}
        confirmLabel="Clear archive"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
