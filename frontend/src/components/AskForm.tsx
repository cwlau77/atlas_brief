import { useState, type FormEvent } from 'react'
import { PlusIcon } from './icons'
import './askform.css'

const FREQUENCIES = ['daily', 'twice-daily', 'weekly'] as const

export function AskForm({ id, compact = false, loading, error, onGenerate, onRetry, placeholder = 'about the Strait of Hormuz', prefill }: {
  id: string
  compact?: boolean
  loading: boolean
  error: string | null
  onGenerate: (focus: string, frequency: string) => void
  onRetry: () => void
  placeholder?: string
  /** Pushes text into the input from outside; bump `n` to re-apply the same text. */
  prefill?: { text: string; n: number }
}) {
  const [focus, setFocus] = useState('')
  const [appliedPrefill, setAppliedPrefill] = useState(0)
  if (prefill && prefill.n !== appliedPrefill) {
    setAppliedPrefill(prefill.n)
    setFocus(prefill.text)
  }
  const [frequency, setFrequency] = useState<string>('daily')
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
          {loading ? 'Briefing…' : <>Brief me<PlusIcon /></>}
        </button>
      </div>
      {error && !loading && (
        <div className="ask-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-quiet" onClick={onRetry}>Try again</button>
        </div>
      )}
    </form>
  )
}
