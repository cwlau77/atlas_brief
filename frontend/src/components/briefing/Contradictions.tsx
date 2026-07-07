import type { Contradiction } from '../../lib/types'
import { ScaleIcon } from '../icons'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

// The signature analytic feature: cross-source disagreement, laid out as two
// accounts split by a dashed center rule — two charts of the same territory.
export function Contradictions({ contradictions }: { contradictions: Contradiction[] }) {
  if (!contradictions.length) return null
  return (
    <section className="brief-section" aria-labelledby="contra-heading">
      <div className="plate-label" id="contra-heading">
        <ScaleIcon size={13} /> Cross-source contradictions
      </div>
      <div className="contra-stack">
        {contradictions.map((c, i) => (
          <Reveal key={`${c.topic}-${i}`} delay={i * 0.05}>
            <article className="card contra-card">
              <h3 className="contra-topic">{c.topic}</h3>
              <div className="contra-split">
                <div className="contra-side">
                  <span className="contra-side-label mono">ACCOUNT A</span>
                  <p>{c.account_a}</p>
                  <SourceChips sources={c.sources_a} />
                </div>
                <div className="contra-side">
                  <span className="contra-side-label mono">ACCOUNT B</span>
                  <p>{c.account_b}</p>
                  <SourceChips sources={c.sources_b} />
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
