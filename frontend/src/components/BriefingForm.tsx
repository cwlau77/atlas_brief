import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PinIcon } from './icons'
import './briefingform.css'

export const FREQUENCIES = ['daily', 'twice-daily', 'weekly'] as const

// Honest loading narrative: the free-tier backend sleeps when idle, and the
// synthesis pipeline itself takes tens of seconds. Say so instead of spinning.
const STAGES: { after: number; text: string }[] = [
  { after: 0, text: 'Contacting the atlas…' },
  { after: 8, text: 'Waking the backend — free hosting naps when idle, this can take up to a minute…' },
  { after: 25, text: 'Still charting — aggregating sources, deduplicating, synthesizing…' },
]

function useStagedMessage(active: boolean): string {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0]
  return stage.text
}

export function BriefingForm({ loading, onGenerate }: {
  loading: boolean
  onGenerate: (focus: string, frequency: string) => void
}) {
  const [focus, setFocus] = useState('')
  const [frequency, setFrequency] = useState<string>('daily')
  const stageText = useStagedMessage(loading)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = focus.trim()
    if (trimmed.length >= 2 && !loading) onGenerate(trimmed, frequency)
  }

  const valid = focus.trim().length >= 2 && focus.trim().length <= 200

  return (
    <form className="brief-form" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="focus-input">
        Area of focus
      </label>
      <div className="brief-form-shell glass">
        <div className="brief-form-field">
          <PinIcon size={15} className="brief-form-pin" />
          <input
            id="focus-input"
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Chart a focus — South Asian security, climate policy, trade…"
            minLength={2}
            maxLength={200}
            disabled={loading}
            autoComplete="off"
          />
        </div>
        <select
          aria-label="Update frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={loading}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={!valid || loading}>
          {loading ? 'Charting…' : 'Generate brief'}
        </button>
      </div>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.p
            key={stageText}
            className="brief-form-stage mono"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <span className="stage-beacon" aria-hidden />
            {stageText}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  )
}
