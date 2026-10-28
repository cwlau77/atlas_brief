import { arcControl, leaderPath, type Box, type Pt, type Side } from './layout'

export interface OverlayProps {
  anchor: Pt | null
  box: Box | null
  side: Side | null
  /** End points of the co-mention arcs. */
  arcs: Pt[]
  reduced: boolean
  /** A new value restarts the sequence. */
  seq: number
}

/** Arcs start 950ms into the hover, 140ms apart; each end ring shows 600ms after its arc starts. */
const ARC_START_MS = 950
const ARC_STAGGER_MS = 140
const ARC_END_AFTER_MS = 600

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * The hover sequence over the map, in map pixels: the point and its ring, the leader to
 * the card, and the arcs. The timings live in hotspots.css as animation delays, so
 * remounting on a new seq replays them, and under reduced motion the final state shows.
 */
export function Overlay({ anchor, box, side, arcs, reduced, seq }: OverlayProps) {
  return (
    <svg className={reduced ? 'hs-overlay is-reduced' : 'hs-overlay'} aria-hidden="true">
      {anchor && (
        <g key={seq}>
          {arcs.map((end, j) => {
            const [cx, cy] = arcControl(anchor, end)
            const start = ARC_START_MS + j * ARC_STAGGER_MS
            return (
              <g key={j}>
                <path
                  className="hs-arc"
                  d={`M${r1(anchor[0])},${r1(anchor[1])} Q${r1(cx)},${r1(cy)} ${r1(end[0])},${r1(end[1])}`}
                  pathLength={1}
                  style={{ animationDelay: `${start}ms` }}
                />
                <circle
                  className="hs-arc-end"
                  cx={end[0]}
                  cy={end[1]}
                  r={3.5}
                  style={{ animationDelay: `${start + ARC_END_AFTER_MS}ms` }}
                />
              </g>
            )
          })}
          {box && side && <path className="hs-leader" d={leaderPath(anchor, box, side)} pathLength={1} />}
          <circle className="hs-ring" cx={anchor[0]} cy={anchor[1]} r={18} />
          <circle className="hs-pt" cx={anchor[0]} cy={anchor[1]} r={4} />
        </g>
      )}
    </svg>
  )
}
