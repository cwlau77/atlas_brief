import { describe, expect, it } from 'vitest'
import { ROUTE_COLORS } from './lib/routes'

const files = import.meta.glob(['./**/*.{ts,tsx,css}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const tokens = files['./styles/tokens.css']

const RETIRED = /--(oat|celadon|sand|signal|ochre|rule-soft)\b|B4CCBE|5E8A79|3A5F52|2F4E43|EEE8DC|E4DCCB|3358C7|24408F|9C7026|C7B89C|94,\s?138,\s?121/i
// Still on the old palette until their own tasks: removed in Task 5 (engine) and Task 6 (AtlasMark).
const EXEMPT = new Set(['./components/AtlasMark.tsx', './globe/engine.ts'])

const NEWSPRINT: Record<string, string> = {
  '--paper': '#F5F5F1',
  '--paper-deep': '#EBEBE6',
  '--ink': '#0E1116',
  '--ink-2': '#3F4752',
  '--ink-3': '#636A75',
  '--rule': '#DADBD5',
  '--rule-strong': '#B9BBB3',
  '--accent': '#1F3FE0',
  '--accent-press': '#1832B8',
  '--accent-wash': 'rgba(31, 63, 224, 0.08)',
  '--hot': '#E2381B',
  '--hot-ink': '#B8280F',
  '--warm': '#C27400',
  '--warm-ink': '#8F5600',
}

/** The value a token is declared with in tokens.css. */
function token(name: string): string {
  const m = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`${name} is not declared in tokens.css`)
  return m[1].trim()
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function hsl(hex: string): { h: number; s: number } {
  const [r, g, b] = rgb(hex).map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2
  if (d === 0) return { h: 0, s: 0 }
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s }
}

describe('newsprint palette', () => {
  it('defines the newsprint tokens', () => {
    for (const [name, value] of Object.entries(NEWSPRINT)) expect(tokens).toContain(`${name}: ${value};`)
    for (const t of ['--space-1: 4px', '--space-9: 96px']) expect(tokens).toContain(t)
  })

  it('leaves no retired colour or token in source', () => {
    const offenders = Object.entries(files).filter(([f, src]) => !EXEMPT.has(f) && RETIRED.test(src)).map(([f]) => f)
    expect(offenders).toEqual([])
  })

  it('every var() resolves', () => {
    const all = Object.values(files).join('\n')
    const used = new Set([...all.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))
    const missing = [...used].filter((name) => !all.includes(`${name}:`) && !all.includes(`'${name}'`))
    expect(missing).toEqual([])
  })
})

describe('contrast', () => {
  const TEXT = ['--ink', '--ink-2', '--ink-3', '--accent', '--hot-ink', '--warm-ink']

  it('text tokens meet AA on both paper tones', () => {
    for (const bg of ['#F5F5F1', '#EBEBE6']) {
      for (const t of TEXT) expect(contrast(token(t), bg), `${t} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('heat graphics meet 3:1 on paper', () => {
    for (const t of ['--hot', '--warm']) expect(contrast(token(t), '#F5F5F1'), t).toBeGreaterThanOrEqual(3)
  })

  it('route colours meet 3:1 on paper', () => {
    for (const c of ROUTE_COLORS) expect(contrast(c.hex, '#F5F5F1'), c.hex).toBeGreaterThanOrEqual(3)
  })

  it('route colours are distinguishable from each other', () => {
    for (let i = 0; i < ROUTE_COLORS.length; i++) {
      for (let j = i + 1; j < ROUTE_COLORS.length; j++) {
        const [a, b] = [ROUTE_COLORS[i].hex, ROUTE_COLORS[j].hex]
        const [ha, hb] = [hsl(a), hsl(b)]
        const hue = Math.min(Math.abs(ha.h - hb.h), 360 - Math.abs(ha.h - hb.h))
        const distinct = contrast(a, b) >= 1.25 || hue >= 25 || Math.abs(ha.s - hb.s) >= 0.3
        expect(distinct, `${a} vs ${b}`).toBe(true)
      }
    }
  })

  it('route colours never borrow the heat colours', () => {
    const heat = [token('--hot'), token('--warm')].map((h) => h.toUpperCase())
    for (const c of ROUTE_COLORS) expect(heat).not.toContain(c.hex.toUpperCase())
  })

  it('declares each route colour in tokens.css with the same hex', () => {
    for (const c of ROUTE_COLORS) expect(token(c.token).toUpperCase()).toBe(c.hex.toUpperCase())
  })
})
