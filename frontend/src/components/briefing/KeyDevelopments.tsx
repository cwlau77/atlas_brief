import type { ViewDevelopment } from '../../lib/normalize'
import { relativeTime } from '../../lib/relativeTime'
import { useSpotlight } from '../../lib/useSpotlight'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

export function KeyDevelopments({ developments }: { developments: ViewDevelopment[] }) {
  const spot = useSpotlight()
  if (!developments.length) return null
  return (
    <section className="brief-section" aria-labelledby="dev-heading">
      <div className="signal-label" id="dev-heading">
        <span className="label-index" aria-hidden>02</span> Key developments
      </div>
      <div className="dev-stack">
        {developments.map((dev, i) => (
          <Reveal key={`${dev.title}-${i}`} delay={i * 0.05}>
            {/* dev-N anchors are the globe hotspot dropdowns' scroll targets */}
            <article className={`panel spot dev-card dev-${dev.priority}`} id={`dev-${i}`} onMouseMove={spot}>
              <header className="dev-head">
                <h3 className="dev-title">{dev.title}</h3>
                <span className="dev-time mono">{relativeTime(dev.timestamp)}</span>
              </header>
              <p className="dev-summary">{dev.content}</p>
              {dev.historicalContext && (
                <aside className="dev-archive">
                  <span className="dev-archive-label mono">FROM THE ARCHIVE</span>
                  <p>{dev.historicalContext}</p>
                </aside>
              )}
              <footer className="dev-foot">
                {dev.regions.length > 0 && (
                  <div className="region-tags">
                    {dev.regions.map((r) => (
                      <span key={r} className="region-tag mono">{r}</span>
                    ))}
                  </div>
                )}
                <SourceChips sources={dev.sources} />
              </footer>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
