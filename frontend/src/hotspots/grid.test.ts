import { describe, expect, it } from 'vitest'
import { GRIDS, type GridDensity, type HotspotGrid } from './grid'

const at = (g: HotspotGrid, lng: number, lat: number) =>
  Math.floor((80 - lat) / g.cellDeg) * g.cols + Math.floor((lng + 180) / g.cellDeg)

describe('hotspot grid', () => {
  it('desktop grid is 132 columns from 180°W, 80°N to 58°S', () => {
    expect(GRIDS.desktop.cols).toBe(132)
    expect(GRIDS.desktop.rows).toBe(Math.ceil(138 / (360 / 132)))
  })

  it('mobile grid is 72 columns of 5 degrees', () => {
    expect(GRIDS.mobile.cols).toBe(72)
    expect(GRIDS.mobile.cellDeg).toBe(5)
    expect(GRIDS.mobile.rows).toBe(28)
  })

  it('places countries where they are', () => {
    expect(GRIDS.desktop.cells['804']).toContain(at(GRIDS.desktop, 31, 49)) // Ukraine
    expect(GRIDS.desktop.cells['076']).toContain(at(GRIDS.desktop, -50, -10)) // Brazil
  })

  it.each(['desktop', 'mobile'] as GridDensity[])('no cell belongs to two countries (%s)', (d) => {
    const all = Object.values(GRIDS[d].cells).flat()
    expect(new Set(all).size).toBe(all.length)
  })

  it('every country with an id has at least one cell and an anchor', () => {
    for (const id of ['376', '422']) {
      expect(GRIDS.desktop.cells[id]?.length).toBeGreaterThan(0)
      expect(GRIDS.desktop.anchors[id]).toHaveLength(2)
    }
    for (const g of Object.values(GRIDS)) {
      for (const id of Object.keys(g.cells)) expect(g.anchors[id]).toBeDefined()
    }
  })

  it('uses the anchor overrides', () => {
    const g = GRIDS.desktop
    const [c, r] = g.anchors['840']
    expect(c).toBeCloseTo((-98 + 180) / g.cellDeg, 1)
    expect(r).toBeCloseTo((80 - 39) / g.cellDeg, 1)
  })

  // Rings that cross the antimeridian (Chukotka, Fiji) must not flip the point-in-polygon test.
  const near = (g: HotspotGrid, id: string, lng: number, lat: number) => {
    const c0 = Math.floor((lng + 180) / g.cellDeg)
    const r0 = Math.floor((80 - lat) / g.cellDeg)
    return (g.cells[id] ?? []).some((i) => {
      const dc = Math.abs((i % g.cols) - c0)
      return Math.min(dc, g.cols - dc) <= 1 && Math.abs(Math.floor(i / g.cols) - r0) <= 1
    })
  }

  it.each(['desktop', 'mobile'] as GridDensity[])('Russia does not wrap across North America (%s)', (d) => {
    const g = GRIDS[d]
    const cell = at(g, -100, 66)
    expect(g.cells['643']).not.toContain(cell)
    const owner = Object.entries(g.cells).find(([, cs]) => cs.includes(cell))?.[0]
    if (owner) expect(owner).toBe('124')
    // Russia lies east of 19°E, apart from Chukotka's tip just west of the antimeridian.
    for (const i of g.cells['643']) {
      const lng = -180 + ((i % g.cols) + 0.5) * g.cellDeg
      expect(lng > 19 || lng < -165, `Russia cell at ${lng}`).toBe(true)
    }
  })

  it.each(['desktop', 'mobile'] as GridDensity[])('Russia keeps Chukotka (%s)', (d) => {
    expect(near(GRIDS[d], '643', 175, 66)).toBe(true)
  })

  it.each(['desktop', 'mobile'] as GridDensity[])('Fiji sits near 178°E, 17°S (%s)', (d) => {
    const g = GRIDS[d]
    expect(g.cells['242']?.length).toBeGreaterThan(0)
    for (const i of g.cells['242']) {
      const lng = -180 + ((i % g.cols) + 0.5) * g.cellDeg
      const lat = 80 - (Math.floor(i / g.cols) + 0.5) * g.cellDeg
      expect(lng > 170 || lng < -175, `lng ${lng}`).toBe(true)
      expect(lat).toBeGreaterThan(-23)
      expect(lat).toBeLessThan(-11)
    }
    const [c] = g.anchors['242']
    const anchorLng = -180 + c * g.cellDeg
    expect(anchorLng > 170 || anchorLng < -175, `anchor lng ${anchorLng}`).toBe(true)
  })
})
