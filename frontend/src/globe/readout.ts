import { nearestCountry } from '../lib/places'

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`

const clocks = new Map<string, Intl.DateTimeFormat>()
function localTime(timeZone: string, now: Date): string {
  let clock = clocks.get(timeZone)
  if (!clock) {
    clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone })
    clocks.set(timeZone, clock)
  }
  return clock.format(now)
}

/** "Eritrea · 14:32 local · 15.50° N  41.80° E": the place and its time only where they're certain. */
export function formatReadout(lat: number, lng: number, now: Date): string {
  const coords = `${fmtCoord(lat, 'N', 'S')}  ${fmtCoord(lng, 'E', 'W')}`
  const place = nearestCountry(lat, lng)
  if (!place) return coords
  return place.timeZone ? `${place.name} · ${localTime(place.timeZone, now)} local · ${coords}` : `${place.name} · ${coords}`
}

/** Writes the live globe coordinates into the corner readout without a React render. */
export function applyReadout(el: HTMLElement | null, text: string | null): void {
  if (!el) return
  el.textContent = text ?? ''
  el.dataset.visible = String(text !== null)
}
