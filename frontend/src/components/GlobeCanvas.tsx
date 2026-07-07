// Heavy chunk: three.js + globe geometry. Loaded lazily via GlobeHero so the
// briefing UI is interactive before any of this arrives over the wire.
import { useEffect, useMemo, useRef } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { AmbientLight, Color, MeshPhongMaterial } from 'three'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import countriesTopo from 'world-atlas/countries-110m.json'
import { resolveRegion } from '../lib/centroids'

export interface GlobePoint {
  name: string
  count: number
  lat: number
  lng: number
}

// Parchment landmasses on a midnight sea — inverted-atlas look.
const LAND_COLOR = 'rgba(240, 232, 212, 0.95)'
const SEA_COLOR = '#1b2b47'
const POINT_COLOR = '#c65b39'

type CountriesTopology = Topology<{ countries: GeometryCollection<{ name: string }> }>
const topo = countriesTopo as unknown as CountriesTopology
const countries = feature(topo, topo.objects.countries)

export function buildPoints(regionCounts: Record<string, number>): GlobePoint[] {
  return Object.entries(regionCounts)
    .map(([name, count]) => {
      const geo = resolveRegion(name)
      return geo ? { name, count, lat: geo.lat, lng: geo.lng } : null
    })
    .filter((p): p is GlobePoint => p !== null)
}

export default function GlobeCanvas({ width, height, regionCounts }: {
  width: number
  height: number
  regionCounts: Record<string, number> | null
}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  const globeMaterial = useMemo(
    () => new MeshPhongMaterial({ color: new Color(SEA_COLOR), transparent: false }),
    [],
  )

  const points = useMemo(() => buildPoints(regionCounts ?? {}), [regionCounts])
  const maxCount = points.reduce((m, p) => Math.max(m, p.count), 1)

  // Ease the camera toward the densest region when a briefing arrives.
  useEffect(() => {
    const globe = globeRef.current
    if (!globe || points.length === 0) return
    const top = points.reduce((a, b) => (b.count > a.count ? b : a))
    globe.pointOfView({ lat: top.lat, lng: top.lng, altitude: 1.9 }, 1200)
  }, [points])

  const handleReady = () => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.55
    controls.enableZoom = false // never fight the page scroll
    // Uniform ambient light instead of the default sun: an atlas has no night
    // side — landmasses stay parchment all the way around.
    globe.lights([new AmbientLight(0xffffff, 3.4)])
    globe.pointOfView({ lat: 18, lng: 12, altitude: 2.1 }, 0)
  }

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeMaterial={globeMaterial}
      showAtmosphere
      atmosphereColor="#5b6b83"
      atmosphereAltitude={0.18}
      hexPolygonsData={countries.features}
      hexPolygonResolution={3}
      hexPolygonMargin={0.55}
      hexPolygonUseDots
      hexPolygonColor={() => LAND_COLOR}
      pointsData={points}
      pointLat={(d) => (d as GlobePoint).lat}
      pointLng={(d) => (d as GlobePoint).lng}
      pointColor={() => POINT_COLOR}
      pointAltitude={(d) => 0.04 + 0.16 * ((d as GlobePoint).count / maxCount)}
      pointRadius={(d) => 0.5 + 0.9 * ((d as GlobePoint).count / maxCount)}
      pointLabel={(d) => {
        const p = d as GlobePoint
        return `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;background:#16233a;color:#f4eee1;padding:4px 8px;border-radius:4px;border:1px solid rgba(244,238,225,.25)">${p.name} — ${p.count} mention${p.count === 1 ? '' : 's'}</div>`
      }}
      onGlobeReady={handleReady}
    />
  )
}
