import { describe, expect, it } from 'vitest'
import { countryAt } from './places'

describe('countryAt', () => {
  it('names the country the point is in', () => {
    expect(countryAt(15.33, 38.93)?.name).toBe('Eritrea')
    expect(countryAt(51.2, 10.5)?.name).toBe('Germany')
  })

  it('names nothing over open ocean', () => {
    expect(countryAt(0, -30)).toBeNull()
  })

  it('gives a zone only for single-zone countries', () => {
    expect(countryAt(35.9, 104.2)?.timeZone).toBe('Asia/Shanghai')
    expect(countryAt(39.8, -98.6)).toEqual({ name: 'United States', timeZone: null })
  })

  it('names the big country near a small neighbour, not the nearer centroid', () => {
    expect(countryAt(55.76, 37.62)?.name).toBe('Russia') // Moscow, not Belarus
    expect(countryAt(25.76, -80.19)?.name).toBe('United States') // Miami, not Cuba
    expect(countryAt(39.47, 75.99)).toEqual({ name: 'China', timeZone: 'Asia/Shanghai' }) // Kashgar
    expect(countryAt(29.65, 91.1)?.name).toBe('China') // Lhasa
    expect(countryAt(43.12, 131.89)).toEqual({ name: 'Russia', timeZone: null }) // Vladivostok
  })

  it('tells the two Congos apart', () => {
    expect(countryAt(-1.0, 15.5)?.name).toBe('Congo')
    expect(countryAt(-4.0, 21.8)?.name).toBe('Democratic Republic of the Congo')
  })
})
