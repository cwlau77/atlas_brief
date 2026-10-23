import { describe, expect, it } from 'vitest'
import { SCAN_SPIN, spinTarget } from './spin'

const base = { reduced: false, hold: false, scanning: false, idle: true, engaged: false, baseSpin: 0.045 }

describe('spinTarget', () => {
  it('idles at the base spin and scans faster while a briefing builds', () => {
    expect(spinTarget(base)).toBe(0.045)
    expect(spinTarget({ ...base, scanning: true, idle: false })).toBe(SCAN_SPIN)
  })

  it('holds still on a held target, even while scanning', () => {
    expect(spinTarget({ ...base, scanning: true, hold: true, idle: false })).toBe(0)
  })

  it('stops scanning while the reader drags or points at the globe', () => {
    expect(spinTarget({ ...base, scanning: true, idle: false, engaged: true })).toBe(0)
  })

  it('never spins under reduced motion', () => {
    expect(spinTarget({ ...base, reduced: true, scanning: true })).toBe(0)
  })
})
