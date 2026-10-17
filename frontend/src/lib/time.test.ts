import { describe, expect, it } from 'vitest'
import {
  AUTO_ZONE, UNKNOWN_TIME, deviceTimeZone, formatClock, formatDate, formatDateTime, formatTime,
  isValidTimeZone, listTimeZones, resolveTimeZone, zoneLabel,
} from './time'

const AUTUMN = '2026-10-16T18:32:00Z'
const WINTER = '2026-01-15T18:32:00Z'

describe('formatTime', () => {
  it('formats Eastern daylight time', () => {
    expect(formatTime(AUTUMN, 'America/New_York')).toBe('14:32 EDT')
  })
  it('switches to Eastern standard time in winter', () => {
    expect(formatTime(WINTER, 'America/New_York')).toBe('13:32 EST')
  })
  it('formats UTC', () => {
    expect(formatTime(AUTUMN, 'UTC')).toBe('18:32 UTC')
  })
  it('shows midnight as 00, not 24', () => {
    expect(formatTime('2026-10-16T04:00:00Z', 'America/New_York')).toBe('00:00 EDT')
  })
  it('accepts Date objects', () => {
    expect(formatTime(new Date(AUTUMN), 'UTC')).toBe('18:32 UTC')
  })
  it('falls back to the device zone for an invalid zone', () => {
    expect(formatTime(AUTUMN, 'Mars/Olympus_Mons')).toBe(formatTime(AUTUMN, deviceTimeZone()))
  })
  it('treats auto as the device zone', () => {
    expect(formatTime(AUTUMN, AUTO_ZONE)).toBe(formatTime(AUTUMN, deviceTimeZone()))
  })
  it('returns a readable label for missing or unparseable timestamps', () => {
    expect(formatTime(null, 'UTC')).toBe(UNKNOWN_TIME)
    expect(formatTime('', 'UTC')).toBe(UNKNOWN_TIME)
    expect(formatTime('not a date', 'UTC')).toBe(UNKNOWN_TIME)
  })
})

describe('formatDate and formatDateTime', () => {
  it('formats the calendar date in the zone', () => {
    expect(formatDate(AUTUMN, 'UTC')).toBe('16 Oct 2026')
    expect(formatDate(null, 'UTC')).toBe('Date unknown')
  })
  it('joins date and time', () => {
    expect(formatDateTime(AUTUMN, 'America/New_York')).toBe('16 Oct 2026, 14:32 EDT')
  })
  it('uses the zone date when UTC has already rolled over', () => {
    expect(formatDateTime('2026-10-17T02:00:00Z', 'America/New_York')).toBe('16 Oct 2026, 22:00 EDT')
  })
  it('returns the unknown label for bad input', () => {
    expect(formatDateTime('garbage', 'UTC')).toBe(UNKNOWN_TIME)
  })
})

describe('formatClock', () => {
  it('returns weekday date and time', () => {
    expect(formatClock(new Date(AUTUMN), 'UTC')).toEqual({ day: 'Friday 16 Oct 2026', time: '18:32 UTC' })
  })
})

describe('zoneLabel', () => {
  it('labels a city zone with its offset', () => {
    expect(zoneLabel('America/New_York', new Date(WINTER))).toBe('New York · UTC-05:00')
  })
  it('handles half-hour offsets', () => {
    expect(zoneLabel('Asia/Kolkata', new Date(AUTUMN))).toBe('Kolkata · UTC+05:30')
  })
  it('names UTC in words', () => {
    expect(zoneLabel('UTC', new Date(AUTUMN))).toBe('Coordinated Universal Time · UTC+00:00')
  })
})

describe('zone validation', () => {
  it('accepts real zones and rejects others', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone('Not/AZone')).toBe(false)
  })
  it('resolves auto, empty and invalid zones to the device zone', () => {
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London')
    expect(resolveTimeZone(AUTO_ZONE)).toBe(deviceTimeZone())
    expect(resolveTimeZone(undefined)).toBe(deviceTimeZone())
    expect(resolveTimeZone('Not/AZone')).toBe(deviceTimeZone())
  })
  it('lists zones including UTC', () => {
    const zones = listTimeZones()
    expect(zones).toContain('UTC')
    expect(zones).toContain('America/New_York')
  })
})
