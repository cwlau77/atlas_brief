import { describe, expect, it } from 'vitest'
import { applyReadout } from './readout'

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
