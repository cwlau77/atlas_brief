#!/usr/bin/env node
// Builds src/hotspots/grid.ts: which map grid cells belong to each country
// (world-atlas countries-110m), so the Hotspots page needs no geo library at
// runtime. Run with `npm run build:grid` after upgrading world-atlas.
// Also builds src/hotspots/countryNames.ts: each grid country's ISO2 and name
// (from backend/data/countries.csv, the backend's own names), so a country
// absent from a snapshot can still be named on hover.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { feature } = require('topojson-client')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const topo = JSON.parse(readFileSync(resolve(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'))
const countries = feature(topo, topo.objects.countries).features

// Grid territories the backend does not count as countries.
const TERRITORIES = {
  238: ['FK', 'Falkland Islands'], 260: ['TF', 'French Southern Lands'], 304: ['GL', 'Greenland'],
  540: ['NC', 'New Caledonia'], 630: ['PR', 'Puerto Rico'], 732: ['EH', 'Western Sahara'],
}

const LNG_MIN = -180
const LAT_MAX = 80
const SPAN = 138 // 80°N to 58°S
const DENSITIES = { desktop: 132, mobile: 72 }
// [lng, lat] anchor overrides for countries whose cell mean sits oddly.
const OVERRIDES = {
  840: [-98, 39], 250: [2.5, 46.5], 643: [60, 58], 124: [-100, 58], 36: [134, -25],
}

const bboxOf = (ring) => {
  let minX = Infinity, maxX = -Infinity, minY = 90, maxY = -90
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}
// A ring that crosses the antimeridian (Chukotka, Fiji) jumps between -180 and +180; a ray
// cast against it flips parity along the jump. Shift its western points by +360 so it is
// contiguous (its longitudes then run past 180), and test points at lng and lng + 360.
const unwrap = (ring) => {
  const crosses = ring.some(([x], i) => i > 0 && Math.abs(x - ring[i - 1][0]) > 180)
  return crosses ? ring.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : ring
}
const inRing = (x, y, ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const items = []
for (const f of countries) {
  if (f.id == null || f.id === '010') continue // no id; Antarctica is below the grid
  const g = f.geometry
  const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  const polys = list.map((rings) => {
    const unwrapped = rings.map(unwrap)
    return { rings: unwrapped, bbox: bboxOf(unwrapped[0]) }
  })
  items.push({ id: String(f.id), polys })
}
const containsAt = (poly, lng, lat) => {
  const b = poly.bbox
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3] &&
    inRing(lng, lat, poly.rings[0]) && !poly.rings.slice(1).some((h) => inRing(lng, lat, h))
}
const contains = (poly, lng, lat) => containsAt(poly, lng, lat) || containsAt(poly, lng + 360, lat)

const build = (cols) => {
  const cellDeg = 360 / cols
  const rows = Math.ceil(SPAN / cellDeg)
  const owner = new Map() // cell index -> id
  for (let r = 0; r < rows; r++) {
    const lat = LAT_MAX - (r + 0.5) * cellDeg
    for (let c = 0; c < cols; c++) {
      const lng = LNG_MIN + (c + 0.5) * cellDeg
      const hit = items.find((it) => it.polys.some((p) => contains(p, lng, lat)))
      if (hit) owner.set(r * cols + c, hit.id)
    }
  }
  const cells = {}
  for (const [idx, id] of owner) (cells[id] ??= []).push(idx)
  // Countries too small for any centre: nearest cell to the largest polygon's bbox centre.
  for (const it of items) {
    if (cells[it.id]) continue
    const area = (p) => (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1])
    const big = it.polys.reduce((a, b) => (area(b) > area(a) ? b : a))
    const mid = (big.bbox[0] + big.bbox[2]) / 2
    const lng = mid > 180 ? mid - 360 : mid // an unwrapped ring's centre can run past 180
    const lat = (big.bbox[1] + big.bbox[3]) / 2
    // The cell holding the centre, else the nearest free cell among its 8 neighbours.
    const fc = (lng - LNG_MIN) / cellDeg
    const fr = (LAT_MAX - lat) / cellDeg
    let best = -1, bestD = Infinity
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = Math.floor(fc) + dc, r = Math.floor(fr) + dr
        if (r < 0 || r >= rows || c < 0 || c >= cols || owner.has(r * cols + c)) continue
        const d = (c + 0.5 - fc) ** 2 + (r + 0.5 - fr) ** 2
        if (d < bestD) { bestD = d; best = r * cols + c }
      }
    }
    if (best < 0) continue
    owner.set(best, it.id)
    cells[it.id] = [best]
  }
  const anchors = {}
  for (const [id, list] of Object.entries(cells)) {
    const o = OVERRIDES[Number(id)]
    if (o) {
      anchors[id] = [(o[0] - LNG_MIN) / cellDeg, (LAT_MAX - o[1]) / cellDeg]
    } else {
      let sc = 0, sr = 0
      for (const i of list) { sc += (i % cols) + 0.5; sr += Math.floor(i / cols) + 0.5 }
      anchors[id] = [sc / list.length, sr / list.length]
    }
  }
  for (const id of Object.keys(cells)) cells[id].sort((a, b) => a - b)
  return { cols, rows, cellDeg, cells, anchors }
}

const r2 = (n) => Math.round(n * 100) / 100
const fmt = (g) => {
  const ids = Object.keys(g.cells).sort()
  const cells = ids.map((id) => `    '${id}': [${g.cells[id].join(',')}],`).join('\n')
  const anchors = ids.map((id) => `    '${id}': [${g.anchors[id].map(r2).join(',')}],`).join('\n')
  return `{\n  cols: ${g.cols}, rows: ${g.rows}, lngMin: -180, latMax: 80, cellDeg: ${g.cellDeg},\n  cells: {\n${cells}\n  },\n  anchors: {\n${anchors}\n  },\n}`
}

const grids = Object.fromEntries(Object.entries(DENSITIES).map(([k, cols]) => [k, build(cols)]))
writeFileSync(
  resolve(root, 'src/hotspots/grid.ts'),
  `// Generated by scripts/build-hotspot-grid.mjs. Do not edit by hand.\n` +
    `// Re-run \`npm run build:grid\` after upgrading world-atlas.\n` +
    `export type GridDensity = 'desktop' | 'mobile'\n` +
    `export interface HotspotGrid {\n  cols: number\n  rows: number\n  lngMin: -180\n  latMax: 80\n  cellDeg: number\n` +
    `  /** iso_numeric -> cell indices (row * cols + col) */\n  cells: Record<string, number[]>\n` +
    `  /** iso_numeric -> [col, row] in fractional cell units */\n  anchors: Record<string, [number, number]>\n}\n` +
    `export const GRIDS: Record<GridDensity, HotspotGrid> = {\n  desktop: ${fmt(grids.desktop).replace(/\n/g, '\n  ')},\n  mobile: ${fmt(grids.mobile).replace(/\n/g, '\n  ')},\n}\n`,
)
for (const [k, g] of Object.entries(grids)) console.log(`${k}: ${g.cols}x${g.rows}, ${Object.keys(g.cells).length} countries`)

const csv = readFileSync(resolve(root, '../backend/data/countries.csv'), 'utf8').trim().split('\n').slice(1)
const named = new Map(csv.map((line) => line.split(',')).map(([iso2, num, name]) => [num, [iso2, name]]))
const gridIds = [...new Set(Object.values(grids).flatMap((g) => Object.keys(g.cells)))].sort()
const nameRows = gridIds.map((id) => {
  const entry = named.get(id) ?? TERRITORIES[Number(id)]
  if (!entry) throw new Error(`no ISO2 or name for grid country ${id}: add it to TERRITORIES`)
  return `  '${id}': { iso2: '${entry[0]}', name: '${entry[1].replace(/'/g, "\\'")}' },`
})
writeFileSync(
  resolve(root, 'src/hotspots/countryNames.ts'),
  `// Generated by scripts/build-hotspot-grid.mjs. Do not edit by hand.\n` +
    `/** iso_numeric -> ISO2 and name, for every country on the grid. */\n` +
    `export const COUNTRY_NAMES: Record<string, { iso2: string; name: string }> = {\n${nameRows.join('\n')}\n}\n`,
)
console.log(`names: ${nameRows.length} countries`)
