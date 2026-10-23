import { describe, expect, it } from 'vitest'
import { applyReadout, formatReadout } from './readout'

describe('applyReadout', () => {
  it('shows and clears the text', () => {
    const el = document.createElement('span')
    applyReadout(el, '15.55° N  41.76° E')
    expect(el.textContent).toBe('15.55° N  41.76° E')
    expect(el.dataset.visible).toBe('true')
    applyReadout(el, null)
    expect(el.textContent).toBe('')
    expect(el.dataset.visible).toBe('false')
  })
  it('ignores a missing element', () => {
    expect(() => applyReadout(null, 'x')).not.toThrow()
  })
})

describe('formatReadout', () => {
  it('names the country and its local time where it has one zone', () => {
    expect(formatReadout(15.33, 38.93, new Date('2026-10-22T11:32:00Z'))).toBe('Eritrea · 14:32 local · 15.33° N  38.93° E')
  })

  it('shows coordinates only over open ocean', () => {
    expect(formatReadout(0, -30, new Date('2026-10-22T11:32:00Z'))).toBe('0.00° N  30.00° W')
  })

  it('names a multi-zone country without a time', () => {
    expect(formatReadout(39.8, -98.6, new Date('2026-10-22T11:32:00Z'))).toBe('United States · 39.80° N  98.60° W')
  })
})
