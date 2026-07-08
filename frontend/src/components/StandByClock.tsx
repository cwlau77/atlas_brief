import { useEffect, useState } from 'react'
import './standbyclock.css'

function useUtcNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Big mono UTC clock for the idle StandBy hero — the globe's companion. */
export function StandByClock() {
  const now = useUtcNow()
  const iso = now.toISOString()
  const hh = iso.slice(11, 13)
  const mm = iso.slice(14, 16)
  const date = `${MONTHS[now.getUTCMonth()]} ${String(now.getUTCDate()).padStart(2, '0')} · ${now.getUTCFullYear()}`
  return (
    <div className="standby-clock mono" role="timer" aria-label={`Coordinated universal time ${hh}:${mm}`}>
      <span className="standby-time">
        {hh}
        <span className="standby-colon">:</span>
        {mm}
      </span>
      <span className="standby-date">{date} · UTC</span>
    </div>
  )
}
