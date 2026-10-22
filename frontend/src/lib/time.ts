// Zone-aware formatting. Every clock time the app displays goes through here,
// so the Settings time zone applies everywhere at once.

export const AUTO_ZONE = 'auto'
export const UNKNOWN_TIME = 'Time unknown'

const FALLBACK_ZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Cairo',
  'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Australia/Sydney',
]

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function resolveTimeZone(tz: string | null | undefined): string {
  return tz && tz !== AUTO_ZONE && isValidTimeZone(tz) ? tz : deviceTimeZone()
}

const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz })
    cache.set(key, f)
  }
  return f
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function parts(d: Date, tz: string, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of formatter(tz, opts).formatToParts(d)) out[p.type] = p.value
  return out
}

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
const DAY_OPTS: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }

export function formatTime(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return UNKNOWN_TIME
  const p = parts(d, resolveTimeZone(tz), TIME_OPTS)
  return `${p.hour}:${p.minute} ${p.timeZoneName}`
}

export function formatDate(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return 'Date unknown'
  const p = parts(d, resolveTimeZone(tz), DATE_OPTS)
  return `${p.day} ${p.month} ${p.year}`
}

export function formatDateTime(value: string | Date | null | undefined, tz: string): string {
  const d = toDate(value)
  if (!d) return UNKNOWN_TIME
  return `${formatDate(d, tz)}, ${formatTime(d, tz)}`
}

const WIRE_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}

/** Wire timestamp: `HH:MM` for today (or later) in the zone, `Ddd HH:MM` for an earlier day, '' if unknown. */
export function formatWireTime(value: string | null | undefined, tz: string, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return ''
  const zone = resolveTimeZone(tz)
  const p = parts(d, zone, WIRE_OPTS)
  const n = parts(now, zone, WIRE_OPTS)
  const day = `${p.year}-${p.month}-${p.day}`
  const clock = `${p.hour}:${p.minute}`
  return day >= `${n.year}-${n.month}-${n.day}` ? clock : `${p.weekday} ${clock}`
}

export function formatClock(now: Date, tz: string): { day: string; time: string } {
  const p = parts(now, resolveTimeZone(tz), DAY_OPTS)
  return { day: `${p.weekday} ${p.day} ${p.month} ${p.year}`, time: formatTime(now, tz) }
}

export function zoneLabel(tz: string, now: Date = new Date()): string {
  const zone = resolveTimeZone(tz)
  const raw = parts(now, zone, { timeZoneName: 'longOffset' }).timeZoneName ?? 'GMT'
  const offset = raw === 'GMT' ? 'UTC+00:00' : raw.replace('GMT', 'UTC')
  const city = zone === 'UTC' ? 'Coordinated Universal Time' : (zone.split('/').pop() ?? zone).replace(/_/g, ' ')
  return `${city} · ${offset}`
}

export function listTimeZones(): string[] {
  let zones = FALLBACK_ZONES
  try {
    const fn = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf
    if (fn) zones = fn('timeZone')
  } catch {
    // older engines: keep the short fallback list
  }
  return zones.includes('UTC') ? zones : ['UTC', ...zones]
}
