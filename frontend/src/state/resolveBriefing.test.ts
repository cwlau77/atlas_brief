import { describe, expect, it } from 'vitest'
import { makeBriefing } from '../test/fixtures'
import { findBriefing, isSavedBriefing, latestBriefingId } from './resolveBriefing'

const a = makeBriefing({ id: 'a' })
const b = makeBriefing({ id: 'b' })
const s = makeBriefing({ id: 's' })

describe('findBriefing', () => {
  it('prefers the session briefing', () => {
    expect(findBriefing('s', s, [a, b])).toBe(s)
  })
  it('finds a saved briefing', () => {
    expect(findBriefing('b', s, [a, b])).toBe(b)
  })
  it('returns null for unknown or missing ids', () => {
    expect(findBriefing('zzz', s, [a, b])).toBeNull()
    expect(findBriefing(undefined, s, [a])).toBeNull()
    expect(findBriefing('a', null, [])).toBeNull()
  })
})

describe('latestBriefingId', () => {
  it('uses the session first, then the newest saved, then null', () => {
    expect(latestBriefingId(s, [a])).toBe('s')
    expect(latestBriefingId(null, [a, b])).toBe('a')
    expect(latestBriefingId(null, [])).toBeNull()
  })
})

describe('isSavedBriefing', () => {
  it('accepts a real briefing', () => {
    expect(isSavedBriefing(a)).toBe(true)
  })
  it('rejects corrupted values', () => {
    expect(isSavedBriefing(null)).toBe(false)
    expect(isSavedBriefing('x')).toBe(false)
    expect(isSavedBriefing({ id: 1, area: 'x', keyDevelopments: [] })).toBe(false)
    expect(isSavedBriefing({ id: 'x', area: 'x' })).toBe(false)
  })
})
