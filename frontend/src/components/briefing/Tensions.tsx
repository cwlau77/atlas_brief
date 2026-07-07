import type { ViewTension } from '../../lib/normalize'
import { CompassIcon } from '../icons'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

export function Tensions({ tensions }: { tensions: ViewTension[] }) {
  if (!tensions.length) return null
  return (
    <section className="brief-section" aria-labelledby="tension-heading">
      <div className="plate-label" id="tension-heading">
        <CompassIcon size={13} /> Emerging tensions
      </div>
      <div className="tension-stack">
        {tensions.map((t, i) => (
          <Reveal key={`${t.actors}-${i}`} delay={i * 0.05}>
            <article className={`card tension-card tension-${t.level}`}>
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
