import type { ViewDevelopment } from '../../lib/normalize'
import { relativeTime } from '../../lib/relativeTime'
import { PinIcon } from '../icons'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

export function KeyDevelopments({ developments }: { developments: ViewDevelopment[] }) {
  if (!developments.length) return null
  return (
    <section className="brief-section" aria-labelledby="dev-heading">
      <div className="plate-label" id="dev-heading">
        <PinIcon size={13} /> Key developments
      </div>
      <div className="dev-stack">
        {developments.map((dev, i) => (
          <Reveal key={`${dev.title}-${i}`} delay={i * 0.05}>
            <article className={`card dev-card dev-${dev.priority}`}>
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
