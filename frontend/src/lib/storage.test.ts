import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBlob, KEYS, loadJSON, saveJSON, storageSummary } from './storage'

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

describe('storageSummary and exportBlob', () => {
  beforeEach(() => {
    window.localStorage.clear()
    saveJSON(KEYS.saved, [{ id: 'a' }, { id: 'b' }])
    saveJSON(KEYS.starred, ['a'])
  })
  afterEach(() => vi.restoreAllMocks())

  it('counts what this browser holds', () => {
    const s = storageSummary()
    expect(s.briefings).toBe(2)
    expect(s.starred).toBe(1)
    expect(s.bytes).toBeGreaterThan(0)
  })

  it('reports zeros when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(storageSummary()).toEqual({ briefings: 0, starred: 0, bytes: 0 })
  })

  it('exports one JSON document of everything stored', async () => {
    const blob = exportBlob()
    expect(blob.type).toBe('application/json')
    const data = JSON.parse(await blob.text())
    expect(Object.keys(data).sort()).toEqual(['exportedAt', 'profile', 'saved', 'settings', 'starred'])
    expect(data.saved).toHaveLength(2)
  })
})
