import type { HotspotSnapshot, Tier } from './data'

/** Heat ramp stops; must match --heat-0..--heat-5 in tokens.css (pinned by palette.test.ts). */
export const HEAT_STOPS: readonly [number, string][] = [
  [0, '#5E9F6E'],
  [0.25, '#A3BF63'],
  [0.45, '#E2BE4E'],
  [0.62, '#E08A2A'],
  [0.8, '#E2381B'],
  [1, '#A3200B'],
]

export const TIER_LABEL: Record<Tier, string> = { quiet: 'Quiet', active: 'Active', elevated: 'Elevated', high: 'High' }

/**
 * Position on the ramp for an article count: log1p-scaled, with the tier cutoffs
 * pinned to .25, .5 and .75 and the busiest country at 1.
 */
export function heatT(n: number, cutoffs: HotspotSnapshot['cutoffs'], nMax: number): number {
  const top = nMax <= cutoffs.high ? cutoffs.high + 1 : nMax
  const domain = [0, cutoffs.active, cutoffs.elevated, cutoffs.high, top].map(Math.log1p)
  const range = [0, 0.25, 0.5, 0.75, 1]
  const x = Math.log1p(Math.max(0, n))
  if (x <= domain[0]) return 0
  for (let i = 1; i < domain.length; i++) {
    if (x <= domain[i]) {
      const span = domain[i] - domain[i - 1]
      if (span <= 0) return range[i]
      return range[i - 1] + ((x - domain[i - 1]) / span) * (range[i] - range[i - 1])
    }
  }
  return 1
}

/** Cell size as a share of its grid slot. */
export function cellScale(t: number): number {
  return 0.5 + 0.38 * t
}

type Triple = [number, number, number]

// D65 white point
const WHITE: Triple = [0.95047, 1, 1.08883]

function toLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function fromLinear(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return s * 255
}

const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
const finv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27))

function hexToLab(hex: string): Triple {
  const n = parseInt(hex.slice(1), 16)
  const r = toLinear((n >> 16) & 255)
  const g = toLinear((n >> 8) & 255)
  const b = toLinear(n & 255)
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b
  const [fx, fy, fz] = [f(x / WHITE[0]), f(y / WHITE[1]), f(z / WHITE[2])]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToHex([l, a, b]: Triple): string {
  const fy = (l + 16) / 116
  const x = finv(fy + a / 500) * WHITE[0]
  const y = finv(fy) * WHITE[1]
  const z = finv(fy - b / 200) * WHITE[2]
  const rgb = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ].map((c) => Math.min(255, Math.max(0, Math.round(fromLinear(c)))))
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
}

const STOP_LAB = HEAT_STOPS.map(([t, hex]) => [t, hexToLab(hex)] as const)

/** Colour on the ramp at t (clamped to 0..1), interpolated in CIELAB; returns #RRGGBB. */
export function heatColour(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  for (let i = 1; i < STOP_LAB.length; i++) {
    const [t1, lab1] = STOP_LAB[i]
    if (x <= t1) {
      const [t0, lab0] = STOP_LAB[i - 1]
      const k = (x - t0) / (t1 - t0)
      return labToHex([0, 1, 2].map((j) => lab0[j] + (lab1[j] - lab0[j]) * k) as Triple)
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1]
}
