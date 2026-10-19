import { useEffect, useMemo, useState } from 'react'

// Half-width and half-height of the crop, in degrees (a 16:9 window).
const HALF_W = 16
const HALF_H = 9

let land: Int16Array | null = null
let landLoad: Promise<Int16Array> | null = null

/** The globe's land dots as [lat*100, lng*100] pairs, loaded on first use so they stay out of the main chunk. */
function loadLand(): Promise<Int16Array> {
  landLoad ??= import('../globe/landPoints').then(({ LAND_POINTS_B64 }) => {
    const bin = atob(LAND_POINTS_B64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    land = new Int16Array(bytes.buffer)
    return land
  })
  return landLoad
}

/**
 * The image fallback: a crop of the globe's land dots around a place, with its
 * name. NaN coordinates (a story with no placeable region) draw the label alone.
 */
export function RegionMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [points, setPoints] = useState<Int16Array | null>(land)
  useEffect(() => {
    if (points) return
    let live = true
    loadLand().then((p) => { if (live) setPoints(p) }, () => {})
    return () => { live = false }
  }, [points])

  const dots = useMemo(() => {
    if (!points || !Number.isFinite(lat) || !Number.isFinite(lng)) return []
    const kx = Math.cos((lat * Math.PI) / 180)
    const out: [number, number][] = []
    for (let i = 0; i < points.length; i += 2) {
      const y = lat - points[i] / 100
      if (Math.abs(y) > HALF_H) continue
      const dl = ((points[i + 1] / 100 - lng + 540) % 360) - 180
      const x = dl * kx
      if (Math.abs(x) > HALF_W) continue
      out.push([x, y])
    }
    return out
  }, [points, lat, lng])

  return (
    <div className="region-map">
      <svg data-region-map viewBox={`${-HALF_W} ${-HALF_H} ${HALF_W * 2} ${HALF_H * 2}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        {dots.map(([x, y], i) => <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="0.3" />)}
        {Number.isFinite(lat) && Number.isFinite(lng) && <circle className="region-map-pin" cx="0" cy="0" r="0.9" />}
      </svg>
      <span className="region-map-label">{label}</span>
    </div>
  )
}
