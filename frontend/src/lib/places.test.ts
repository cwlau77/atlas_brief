import { describe, expect, it } from 'vitest'
import { nearestCountry } from './places'

describe('nearestCountry', () => {
  it('names the nearest country within reach', () => {
    expect(nearestCountry(15.5, 41.8)?.name).toBe('Eritrea')
  })

  it('names a country, never a bloc', () => {
    expect(nearestCountry(51.2, 10.5)?.name).toBe('Germany')
  })

  it('names nothing over open ocean', () => {
    expect(nearestCountry(0, -30)).toBeNull()
  })

  it('gives a zone only for single-zone countries', () => {
    expect(nearestCountry(35.9, 104.2)?.timeZone).toBe('Asia/Shanghai')
    expect(nearestCountry(39.8, -98.6)).toEqual({ name: 'United States', timeZone: null })
  })

  it('tells the two Congos apart', () => {
    expect(nearestCountry(-4.3, 15.3)?.name).toBe('Congo')
    expect(nearestCountry(-4.0, 21.8)?.name).toBe('Democratic Republic of the Congo')
  })
})
