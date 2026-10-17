import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, EMPTY_PROFILE, parseProfile, parseSettings } from './settings'

describe('parseSettings', () => {
  it('returns defaults for missing data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS)
  })
  it('defaults to following the device time zone', () => {
    expect(DEFAULT_SETTINGS.timeZone).toBe('auto')
  })
  it('keeps legacy settings saved before timeZone existed', () => {
    expect(parseSettings({ compactMode: true, autoSave: false, showHistoricalContext: false })).toEqual({
      timeZone: 'auto', compactMode: true, autoSave: false, showHistoricalContext: false,
    })
  })
  it('ignores values of the wrong type', () => {
    expect(parseSettings({ compactMode: 'yes', autoSave: 1, timeZone: 42 })).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps a valid zone and drops an invalid one', () => {
    expect(parseSettings({ timeZone: 'America/New_York' }).timeZone).toBe('America/New_York')
    expect(parseSettings({ timeZone: 'Not/AZone' }).timeZone).toBe('auto')
    expect(parseSettings({ timeZone: 'auto' }).timeZone).toBe('auto')
  })
})

describe('parseProfile', () => {
  it('returns an empty profile for missing data', () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE)
  })
  it('keeps string fields and drops others', () => {
    expect(parseProfile({ firstName: 'Ana', lastName: 7, emailAddress: 'a@b.co' })).toEqual({
      ...EMPTY_PROFILE, firstName: 'Ana', emailAddress: 'a@b.co',
    })
  })
})
