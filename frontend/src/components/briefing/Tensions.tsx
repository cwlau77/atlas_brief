import type { ViewTension } from '../../lib/normalize'
import { useSpotlight } from '../../lib/useSpotlight'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

export function Tensions({ tensions }: { tensions: ViewTension[] }) {
  const spot = useSpotlight()
  if (!tensions.length) return null
  return (
    <section className="brief-section" aria-labelledby="tension-heading">
      <div className="signal-label" id="tension-heading">
        <span className="label-index" aria-hidden>03</span> Emerging tensions
      </div>
      <div className="tension-stack">
        {tensions.map((t, i) => (
          <Reveal key={`${t.actors}-${i}`} delay={i * 0.05}>
            <article className={`panel spot tension-card tension-${t.level}`} onMouseMove={spot}>
              <div className="tension-head">
                <span className={`tension-dot dot-${t.level}`} aria-hidden />
                <span className="tension-actors mono">{t.actors}</span>
                <span className={`tension-level mono level-${t.level}`}>{t.level.toUpperCase()}</span>
              </div>
              <p className="tension-desc">{t.description}</p>
              <SourceChips sources={t.sources} />
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
