import type { CSSProperties } from 'react'
import type { HotspotCountry, HotspotSnapshot } from './data'
import { Flag } from './Flag'
import { heatColour, heatT, TIER_LABEL } from './heat'

export interface TopCountriesProps {
  countries: HotspotCountry[]
  cutoffs: HotspotSnapshot['cutoffs'] | null
  hours: number
  activeIso2: string | null
  onHover(iso2: string | null): void
  /** Row buttons report themselves, so focus can come back to the row that pinned. */
  onPin(iso2: string, row: HTMLButtonElement): void
  /** Desktop: a panel over the stage with a toggle tab. Mobile: always open, no tab. */
  collapsible: boolean
  open: boolean
  onToggle(): void
  /** No snapshot yet: 8 skeleton rows. */
  loading: boolean
}

const TOP_N = 15
const SKELETON_ROWS = 8

const articles = (n: number) => `${n} article${n === 1 ? '' : 's'}`

/** The top 15 countries by articles naming them: the keyboard path to the map and its data. */
export function TopCountries(p: TopCountriesProps) {
  const { countries, cutoffs, hours, activeIso2, onHover, onPin, collapsible, open, onToggle, loading } = p
  const top = countries
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, TOP_N)
  const nMax = Math.max(0, ...countries.map((c) => c.n))

  return (
    <aside
      className={['hs-panel', collapsible ? 'is-collapsible' : '', open ? 'is-open' : ''].filter(Boolean).join(' ')}
      aria-labelledby="hs-panel-h"
    >
      {collapsible && (
        <button type="button" className="hs-panel-tab" aria-expanded={open} aria-controls="hs-panel-body" onClick={onToggle}>
          Top countries
        </button>
      )}
      <div id="hs-panel-body" className="hs-panel-body" inert={collapsible && !open}>
        <header className="hs-panel-head">
          <h2 id="hs-panel-h">Top countries</h2>
          <p>By articles mentioning them, last {hours} hours</p>
        </header>
        <ol className="hs-rows">
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <li key={i} className="is-skel" aria-hidden="true">
                  <span className="hs-row-skel" />
                </li>
              ))
            : top.map((c, i) => {
                const colour = cutoffs ? heatColour(heatT(c.n, cutoffs, nMax)) : undefined
                const sw = { '--hs-sw': colour } as CSSProperties
                return (
                  <li key={c.iso2} className={c.iso2 === activeIso2 ? 'is-on' : undefined} style={{ '--i': i } as CSSProperties}>
                    <button
                      type="button"
                      data-iso2={c.iso2}
                      aria-label={`${c.name}, ${TIER_LABEL[c.tier]}, ${articles(c.n)}`}
                      onPointerEnter={() => onHover(c.iso2)}
                      onPointerLeave={() => onHover(null)}
                      onFocus={() => onHover(c.iso2)}
                      onBlur={() => onHover(null)}
                      onClick={(e) => onPin(c.iso2, e.currentTarget)}
                    >
                      <span className="hs-row-rank mono">{i + 1}</span>
                      <Flag iso2={c.iso2} />
                      <span className="hs-row-name">
                        <span className="hs-row-line">
                          <span className="hs-row-country">{c.name}</span>
                          <span className={`label hs-tier is-${c.tier}`} style={sw}>
                            {TIER_LABEL[c.tier]}
                          </span>
                        </span>
                        <span
                          className="hs-row-bar"
                          style={{ width: `${nMax ? (c.n / nMax) * 100 : 0}%`, background: colour } as CSSProperties}
                        />
                      </span>
                      <span className="hs-row-n mono">{c.n}</span>
                    </button>
                  </li>
                )
              })}
        </ol>
      </div>
    </aside>
  )
}
