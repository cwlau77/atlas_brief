import { describe, expect, it } from 'vitest'
import { resolveRegion } from './centroids'

describe('resolveRegion', () => {
  it('resolves exact country names case-insensitively', () => {
    expect(resolveRegion('India')).toEqual({ lat: 20.6, lng: 79.0 })
    expect(resolveRegion('  UKRAINE ')).toEqual({ lat: 48.4, lng: 31.2 })
  })

  it('resolves supranational regions', () => {
    expect(resolveRegion('South China Sea')).not.toBeNull()
    expect(resolveRegion('Sahel')).not.toBeNull()
  })

  it('resolves qualified names via contained match', () => {
    expect(resolveRegion('eastern Ukraine')).toEqual({ lat: 48.4, lng: 31.2 })
    expect(resolveRegion('US-China relations')).not.toBeNull()
  })

  it('prefers the more specific contained region', () => {
    // "eastern europe" must win over "europe"
    expect(resolveRegion('the eastern europe corridor')).toEqual({ lat: 51.0, lng: 28.0 })
  })

  it('does not match names embedded inside words', () => {
    expect(resolveRegion('sausage festival')).toBeNull()
  })

  it('returns null for unknown regions instead of guessing', () => {
    expect(resolveRegion('Atlantis')).toBeNull()
    expect(resolveRegion('')).toBeNull()
  })
})
