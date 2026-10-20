import { useEffect, useState, type FormEvent } from 'react'
import './askform.css'

const FREQUENCIES = ['daily', 'twice-daily', 'weekly'] as const

// The free-tier backend sleeps when idle and synthesis takes tens of seconds. Say so.
const STAGES: { after: number; text: string }[] = [
  { after: 0, text: 'Contacting Atlas…' },
  { after: 8, text: 'Waking the backend. Free hosting sleeps when idle, so this can take up to a minute…' },
  { after: 25, text: 'Still working: gathering sources, removing duplicates, writing the brief…' },
]

function useStagedMessage(active: boolean): string {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return ([...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0]).text
}

export function AskForm({ id, compact = false, loading, error, onGenerate, onRetry, placeholder = 'about the Strait of Hormuz' }: {
  id: string
  compact?: boolean
  loading: boolean
  error: string | null
  onGenerate: (focus: string, frequency: string) => void
  onRetry: () => void
  placeholder?: string
}) {
  const [focus, setFocus] = useState('')
  const [frequency, setFrequency] = useState<string>('daily')
  const stage = useStagedMessage(loading)
  const trimmed = focus.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 200

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !loading) onGenerate(trimmed, frequency)
  }

  return (
    <form className={`ask ${compact ? 'ask-compact' : ''}`} onSubmit={submit}>
      <div className="ask-field">
        <label className="ask-label label" htmlFor={id}>Ask Atlas</label>
        <input
          id={id}
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={placeholder}
          minLength={2}
          maxLength={200}
          disabled={loading}
          autoComplete="off"
        />
        {!compact && (
          <select aria-label="Briefing cadence" value={frequency} onChange={(e) => setFrequency(e.target.value)} disabled={loading}>
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <button type="submit" className="btn btn-primary" disabled={!valid || loading}>
          {loading ? 'Briefing…' : 'Brief me'}
        </button>
      </div>
      {loading && (
        <p className="ask-stage label" role="status">
          <span className="ask-beacon" aria-hidden="true" />
          {stage}
        </p>
      )}
      {error && !loading && (
        <div className="ask-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-quiet" onClick={onRetry}>Try again</button>
        </div>
      )}
    </form>
  )
}
