import { useId, useMemo, useState } from 'react'
import { AUTO_ZONE, deviceTimeZone, isValidTimeZone, listTimeZones, resolveTimeZone, zoneLabel } from '../lib/time'
import './timezone.css'

export function TimeZonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const listId = useId()
  const options = useMemo(() => listTimeZones().map((z) => ({ zone: z, label: zoneLabel(z) })), [])
  const zoneSet = useMemo(() => new Set(options.map((o) => o.zone)), [options])
  const [draft, setDraft] = useState(value === AUTO_ZONE ? '' : value)
  const [error, setError] = useState<string | null>(null)

  const commit = (next: string) => {
    const tz = next.trim()
    if (!tz) return
    if (isValidTimeZone(tz)) {
      setError(null)
      onChange(tz)
    } else {
      setError('Choose a zone from the list, for example America/New_York.')
    }
  }

  const status = error
    ?? (value === AUTO_ZONE
      ? `Following this device: ${zoneLabel(deviceTimeZone())}`
      : `Showing times in ${zoneLabel(resolveTimeZone(value))}`)

  return (
    <div className="tz">
      <label className="tz-label" htmlFor="tz-input">Time zone</label>
      <div className="tz-row">
        <input
          id="tz-input"
          list={listId}
          value={draft}
          placeholder="Search a zone, e.g. America/New_York"
          autoComplete="off"
          aria-describedby="tz-status"
          aria-invalid={error ? true : undefined}
          data-cursor="text"
          onChange={(e) => {
            setDraft(e.target.value)
            if (zoneSet.has(e.target.value)) commit(e.target.value)
          }}
          onBlur={() => {
            if (draft && draft !== value) commit(draft)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(draft)
            }
          }}
        />
        <button
          type="button"
          className="btn btn-quiet"
          disabled={value === AUTO_ZONE}
          onClick={() => {
            setDraft('')
            setError(null)
            onChange(AUTO_ZONE)
          }}
          data-cursor="link"
        >
          Use my device's time zone
        </button>
      </div>
      <datalist id={listId}>
        {options.map((o) => <option key={o.zone} value={o.zone}>{o.label}</option>)}
      </datalist>
      <p id="tz-status" className={`tz-status ${error ? 'tz-error' : ''}`} role={error ? 'alert' : undefined}>{status}</p>
    </div>
  )
}
