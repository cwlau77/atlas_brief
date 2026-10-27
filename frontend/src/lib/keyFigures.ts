// Key figures: which of a card's figures may share a chart, and how long each bar is.
// The number parsed here only sets a bar's length. It is never shown, rounded, converted or
// combined: the text on screen is always the figure exactly as the article wrote it.

import type { FigureKind, ViewKeyFigure } from './normalize'
import { plural } from './plural'
import { formatDayMonth } from './time'

// Mirrors _FIGURE_QUALIFIERS in backend/synthesis/briefing.py. Two-word entries come first.
const APPROXIMATE = ['an estimated', 'about', 'around', 'roughly', 'nearly', 'almost', 'approximately', 'some', 'estimated']
const BOUNDS = ['more than', 'at least', 'upwards of', 'less than', 'fewer than', 'at most', 'up to', 'over', 'above', 'under', 'below']
const QUALIFIERS = [...APPROXIMATE, ...BOUNDS].sort((a, b) => b.split(' ').length - a.split(' ').length)

const SCALES: Record<string, number> = {
  thousand: 1e3, k: 1e3, million: 1e6, mn: 1e6, m: 1e6, billion: 1e9, bn: 1e9, trillion: 1e12, tn: 1e12,
}

const FIGURE_RE = new RegExp(
  '^(US\\$|[$£€¥₹]|(?:USD|EUR|GBP|JPY|CNY|INR) ?)?' // currency
  + '(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)' // one number
  + ' ?(thousand|million|billion|trillion|mn|bn|tn|k|m)?' // scale
  + ' ?(%|percent|per cent)?' // percent
  + '(?: ([a-z][a-z-]*))?$', // one trailing noun
  'i',
)

export interface ParsedFigure {
  /** Sets bar length only. */
  value: number
  /** `percent`, `money:<currency as written>` or `count:<noun, or empty>`. */
  unit: string
  /** A limit ("below 10%"), not a value: listed, never charted. */
  bound: boolean
}

export function parseFigure(text: string): ParsedFigure | null {
  let rest = text.trim()
  let bound = false
  const lower = rest.toLowerCase()
  const q = QUALIFIERS.find((word) => lower.startsWith(`${word} `))
  if (q) {
    rest = rest.slice(q.length + 1)
    bound = BOUNDS.includes(q)
  }
  const m = FIGURE_RE.exec(rest)
  if (!m) return null
  const [, currency, number, scale, percent, noun] = m
  const value = Number(number.replace(/,/g, '')) * (scale ? SCALES[scale.toLowerCase()] : 1)
  const unit = percent ? 'percent' : currency ? `money:${currency.trim()}` : `count:${(noun ?? '').toLowerCase()}`
  return { value, unit, bound }
}

export interface ChartRow {
  figure: ViewKeyFigure
  /** Bar length as a percentage of the track, or null for no bar. */
  width: number | null
  note: string | null
}

export interface FigureGroups {
  chart: { scale: 'bars' | 'meter'; rows: ChartRow[]; caption: string } | null
  plain: ViewKeyFigure[]
}

const CHARTED: Partial<Record<FigureKind, string>> = { people: 'People', money: 'Money', count: 'Count', share: '' }

/** The unit a figure is compared on for its kind, or null when it can't be charted as that kind. */
function chartUnit(kind: FigureKind, p: ParsedFigure): string | null {
  if (kind === 'share') return p.unit === 'percent' && p.value <= 100 ? 'percent' : null
  if (kind === 'money') return p.unit.startsWith('money:') ? p.unit : null
  if (kind === 'people') return p.unit.startsWith('count:') ? 'people' : null
  return p.unit.startsWith('count:') ? p.unit : null
}

function dateSpan(figures: ViewKeyFigure[], timeZone: string): string {
  const times = figures
    .map((f) => Date.parse(f.source.published_at ?? ''))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  if (!times.length) return ''
  const first = formatDayMonth(new Date(times[0]), timeZone)
  const last = formatDayMonth(new Date(times[times.length - 1]), timeZone)
  if (first === last) return first
  const [day, month] = first.split(' ')
  return last.endsWith(` ${month}`) ? `${day}–${last}` : `${first}–${last}`
}

/** The card's one chart, if two or more figures are comparable, and the figures listed plainly. */
export function figureGroups(figures: ViewKeyFigure[], timeZone: string): FigureGroups {
  const parsed = figures.map((f) => parseFigure(f.figure))
  const keyOf = (i: number): string | null => {
    const kind = figures[i].kind
    const p = parsed[i]
    if (!kind || !(kind in CHARTED) || !p) return null
    const unit = chartUnit(kind, p)
    return unit ? `${kind}|${unit}` : null
  }
  const keys = figures.map((_, i) => keyOf(i))
  // Values (not bounds) per key; the largest set of two or more wins, ties to the earliest.
  const counts = new Map<string, number>()
  keys.forEach((k, i) => { if (k && !parsed[i]!.bound) counts.set(k, (counts.get(k) ?? 0) + 1) })
  let best: string | null = null
  for (const [k, n] of counts) if (n >= 2 && (best === null || n > counts.get(best)!)) best = k
  if (!best) return { chart: null, plain: figures }

  const kind = best.split('|')[0] as FigureKind
  // A same-kind figure that doesn't parse stays in the chart's rows, with no bar.
  const inChart = figures.map((f, i) => keys[i] === best || (f.kind === kind && parsed[i] === null))
  const values = figures.map((_, i) => (keys[i] === best && !parsed[i]!.bound ? parsed[i]!.value : null))
  const max = Math.max(...values.filter((v): v is number => v !== null))
  const meter = kind === 'share'
  const rows: ChartRow[] = figures.flatMap((figure, i) => {
    if (!inChart[i]) return []
    const v = values[i]
    const width = v === null ? null : meter ? v : (v / max) * 100
    return [{ figure, width, note: keys[i] === best && parsed[i]!.bound ? 'a limit, not charted' : null }]
  })
  const charted = rows.map((r) => r.figure)
  const outlets = plural(new Set(charted.map((f) => f.source.outlet)).size, 'outlet')
  const span = dateSpan(charted, timeZone)
  const tail = span ? `${outlets}, ${span}` : outlets
  const caption = meter ? `Shares of 100% · ${tail}` : `${CHARTED[kind]} · one scale from zero · ${tail}`
  return {
    chart: { scale: meter ? 'meter' : 'bars', rows, caption },
    plain: figures.filter((_, i) => !inChart[i]),
  }
}
