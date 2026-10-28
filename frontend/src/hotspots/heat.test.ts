import { describe, expect, it } from 'vitest'
import { HEAT_STOPS, TIER_LABEL, cellScale, heatColour, heatT } from './heat'

const c = { active: 15, elevated: 40, high: 80 }

describe('heat scale', () => {
  it('anchors tiers to quarter points', () => {
    expect(heatT(0, c, 400)).toBe(0)
    expect(heatT(15, c, 400)).toBeCloseTo(0.25)
    expect(heatT(40, c, 400)).toBeCloseTo(0.5)
    expect(heatT(80, c, 400)).toBeCloseTo(0.75)
    expect(heatT(400, c, 400)).toBe(1)
    expect(heatT(9999, c, 400)).toBe(1)
  })
  it('handles nMax at or below the high cutoff', () => {
    expect(heatT(80, c, 10)).toBeCloseTo(0.75)
    expect(heatT(81, c, 10)).toBe(1)
  })
  it('ramp hits its stops exactly', () => {
    for (const [t, hex] of HEAT_STOPS) expect(heatColour(t)).toBe(hex)
  })
  it('interpolates between stops and clamps', () => {
    expect(heatColour(-1)).toBe(HEAT_STOPS[0][1])
    expect(heatColour(2)).toBe(HEAT_STOPS[5][1])
    expect(heatColour(0.35)).toMatch(/^#[0-9A-F]{6}$/)
  })
  it('cell scale runs 0.5 to 0.88', () => {
    expect(cellScale(0)).toBe(0.5)
    expect(cellScale(1)).toBeCloseTo(0.88)
  })
  it('labels tiers', () => {
    expect(TIER_LABEL).toEqual({ quiet: 'Quiet', active: 'Active', elevated: 'Elevated', high: 'High' })
  })
})
