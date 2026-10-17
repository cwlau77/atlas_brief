import { useEffect, useState } from 'react'
import { formatClock } from './time'

export function useClock(tz: string, intervalMs = 15_000): { day: string; time: string } {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return formatClock(now, tz)
}
