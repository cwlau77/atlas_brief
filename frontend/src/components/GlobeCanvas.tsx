// Heavy chunk: three.js + globe geometry. Loaded lazily via GlobeHero so the
// briefing UI is interactive before any of this arrives over the wire.
import { useCallback, useEffect, useMemo, useRef } from 'react'
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

export interface DevelopmentAnchor {
  headline: string
  regions: string[]
  anchorId: string
}

// Midnight Signal duotone: dim white landmass dots on near-black, chartreuse
// hotspots. The globe holds exactly two colors.
const LAND_COLOR = 'rgba(255, 255, 255, 0.35)'
const SEA_COLOR = '#0a0c10'
const ATMOSPHERE = '#c6f135'

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function GlobeCanvas({ width, height, regionCounts, developments }: {
  width: number
  height: number
  regionCounts: Record<string, number> | null
  developments: DevelopmentAnchor[] | null
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

  const setAutoRotate = useCallback((on: boolean) => {
    const controls = globeRef.current?.controls()
    if (controls) controls.autoRotate = on
  }, [])

  // Imperative DOM markers: globe.gl positions raw elements on the sphere, so
  // the hover dropdown is plain HTML/CSS rather than a React portal chase.
  const makeHotspot = useCallback((d: object) => {
    const p = d as GlobePoint
    const scale = p.count / maxCount
    const dot = Math.round(10 + 9 * scale)

    const stories = (developments ?? []).filter((dev) => dev.regions.includes(p.name))
    const rows = stories
      .map(
        (s) => `<button class="hotspot-row" data-anchor="${escapeHtml(s.anchorId)}">${escapeHtml(s.headline)}</button>`,
      )
      .join('')

    const el = document.createElement('div')
    el.className = 'hotspot'
    el.style.pointerEvents = 'auto'
    el.innerHTML = `
      <span class="hotspot-ring" style="width:${dot + 14}px;height:${dot + 14}px"></span>
      <span class="hotspot-dot" style="width:${dot}px;height:${dot}px"></span>
      <div class="hotspot-panel" role="menu" aria-label="Developing stories in ${escapeHtml(p.name)}">
        <div class="hotspot-head mono">${escapeHtml(p.name.toUpperCase())} · ${p.count} MENTION${p.count === 1 ? '' : 'S'}</div>
        ${rows || '<div class="hotspot-none">Plotted from region tags in this briefing.</div>'}
      </div>`

    // Hovering a hotspot freezes the rotation so the dropdown is readable.
    el.addEventListener('mouseenter', () => setAutoRotate(false))
    el.addEventListener('mouseleave', () => setAutoRotate(true))
    el.querySelectorAll<HTMLButtonElement>('.hotspot-row').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        document.getElementById(btn.dataset.anchor ?? '')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }),
    )
    return el
  }, [developments, maxCount, setAutoRotate])

  const handleReady = () => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    controls.enableZoom = false // never fight the page scroll
    // Uniform ambient light: the signal globe has no day/night terminator.
    globe.lights([new AmbientLight(0xffffff, 3.2)])
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
      atmosphereColor={ATMOSPHERE}
      atmosphereAltitude={0.13}
      hexPolygonsData={countries.features}
      hexPolygonResolution={3}
      hexPolygonMargin={0.62}
      hexPolygonUseDots
      hexPolygonColor={() => LAND_COLOR}
      htmlElementsData={points}
      htmlLat={(d) => (d as GlobePoint).lat}
      htmlLng={(d) => (d as GlobePoint).lng}
      htmlAltitude={0.02}
      htmlElement={makeHotspot}
      htmlElementVisibilityModifier={(el, isVisible) => {
        el.style.opacity = isVisible ? '1' : '0'
        el.style.pointerEvents = isVisible ? 'auto' : 'none'
      }}
      onGlobeReady={handleReady}
    />
  )
}
