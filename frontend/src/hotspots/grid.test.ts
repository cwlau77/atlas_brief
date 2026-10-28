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
})
