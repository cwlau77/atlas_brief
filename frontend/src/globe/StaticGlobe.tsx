import type { RegionPoint } from './regions'

/** Shown while the globe chunk loads and when WebGL is unavailable. */
export function StaticGlobe({ label, regions = [], onSelectStory }: {
  label: string
  regions?: RegionPoint[]
  onSelectStory?: (anchorId: string) => void
}) {
  return (
    <div className="globe-static">
      <div className="globe-static-disc" role="img" aria-label={label} />
      {regions.length > 0 && (
        <ul className="globe-static-list">
          {regions.map((r) => (
            <li key={r.name}>
              <span className="label">{r.name} · {r.count}</span>
              <ul>
                {r.stories.map((s) => (
                  <li key={s.anchorId}>
                    <button type="button" className="link-button" onClick={() => onSelectStory?.(s.anchorId)}>{s.title}</button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
