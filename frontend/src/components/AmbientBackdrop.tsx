import './ambient.css'

/**
 * The ambient stage behind the hero: a flowing graph-paper grid, two
 * slow-drifting accent glow blobs, and a rotating conic ring that sits
 * behind the globe. Pure CSS, transform/opacity only, and every layer is
 * frozen by the global prefers-reduced-motion rule in base.css.
 */
export function AmbientBackdrop({ ring = true }: { ring?: boolean }) {
  return (
    <div className="ambient" aria-hidden>
      <div className="ambient-grid-viewport">
        <div className="ambient-grid" />
      </div>
      <div className="ambient-blob ambient-blob-signal" />
      <div className="ambient-blob ambient-blob-haze" />
      {ring && <div className="ambient-ring" />}
    </div>
  )
}
