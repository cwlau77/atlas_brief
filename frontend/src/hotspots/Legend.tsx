import type { CSSProperties } from 'react'
import type { HotspotSnapshot, Tier } from './data'
import type { GridDensity } from './grid'
import { cellScale, heatColour, heatT, TIER_LABEL } from './heat'

export interface LegendProps {
  snapshot: HotspotSnapshot | null
  density: GridDensity
}

const TIERS: Tier[] = ['quiet', 'active', 'elevated', 'high']
/** Each tier's middle on the ramp: its sample cell's colour and size. */
const TIER_MID: Record<Tier, number> = { quiet: 0.125, active: 0.375, elevated: 0.625, high: 0.875 }
/** Sample cell pitch in px: about a map cell at each density, a little larger to read. */
const PITCH: Record<GridDensity, number> = { desktop: 12, mobile: 10 }
/** The ramp as a CSS gradient, sampled every 10% so the Lab interpolation carries over. */
const GRADIENT = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => `${heatColour(i / 10)} ${i * 10}%`).join(', ')})`

/** How to read the map: the ramp with the day's real cutoffs, the tiers and their cell sizes. */
export function Legend({ snapshot, density }: LegendProps) {
  const hours = snapshot && snapshot.coverageHours < 24 ? snapshot.coverageHours : 24
  const nMax = Math.max(0, ...(snapshot?.countries.map((c) => c.n) ?? []))
  const c = snapshot?.cutoffs
  const ticks = c ? [0, c.active, c.elevated, c.high, ...(nMax > c.high ? [nMax] : [])] : []

  return (
    <section className={`hs-legend is-${density}`} aria-labelledby="hs-legend-h">
      <h2 id="hs-legend-h">Mentions, last {hours} hours</h2>
      <p>Articles naming the country · bigger, redder cells, more mentions</p>
      <div className="hs-legend-ramp" style={{ background: GRADIENT }} aria-hidden="true" />
      {c && (
        <div className="hs-legend-ticks mono" aria-label={`Cutoffs: Active from ${c.active}, Elevated from ${c.elevated}, High from ${c.high} articles`}>
          {ticks.map((n, i) => (
            <span key={i} style={{ left: `${heatT(n, c, nMax) * 100}%` }} aria-hidden="true">
              {n}
            </span>
          ))}
        </div>
      )}
      <ul className="hs-legend-tiers">
        {TIERS.map((t) => {
          const style = {
            '--hs-sw': heatColour(TIER_MID[t]),
            '--hs-sz': `${Math.round(PITCH[density] * cellScale(TIER_MID[t]))}px`,
          } as CSSProperties
          return (
            <li key={t} className={`label hs-tier is-${t}`} style={style}>
              {TIER_LABEL[t]}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
