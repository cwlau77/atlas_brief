import { beforeEach, describe, expect, it } from 'vitest'
import { KEYS, loadJSON, saveJSON } from './storage'

describe('storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips values', () => {
    expect(saveJSON(KEYS.settings, { compact: true })).toBe(true)
    expect(loadJSON(KEYS.settings, {})).toEqual({ compact: true })
  })

  it('returns fallback when the key is absent', () => {
    expect(loadJSON(KEYS.saved, [])).toEqual([])
  })

  it('returns fallback on corrupted JSON instead of throwing', () => {
    window.localStorage.setItem(KEYS.saved, '{not json')
    expect(loadJSON(KEYS.saved, [])).toEqual([])
  })

  it('returns fallback for stored null', () => {
    window.localStorage.setItem(KEYS.profile, 'null')
    expect(loadJSON(KEYS.profile, { name: 'anon' })).toEqual({ name: 'anon' })
  })

  it('preserves the legacy storage keys verbatim', () => {
    expect(KEYS).toEqual({
      saved: 'savedBriefingsV2',
      starred: 'starredBriefings',
      profile: 'userProfileV1',
      settings: 'userSettingsV1',
    })
  })
})
