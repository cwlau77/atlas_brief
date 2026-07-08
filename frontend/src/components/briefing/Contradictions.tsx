import type { Contradiction } from '../../lib/types'
import { useSpotlight } from '../../lib/useSpotlight'
import { Reveal } from '../Reveal'
import { SourceChips } from './SourceChips'

// The signature analytic feature: cross-source disagreement, laid out as two
// accounts split by a dashed center rule — two charts of the same territory.
export function Contradictions({ contradictions }: { contradictions: Contradiction[] }) {
  const spot = useSpotlight()
  if (!contradictions.length) return null
  return (
    <section className="brief-section" aria-labelledby="contra-heading">
      <div className="signal-label" id="contra-heading">
        <span className="label-index" aria-hidden>04</span> Cross-source contradictions
      </div>
      <div className="contra-stack">
        {contradictions.map((c, i) => (
          <Reveal key={`${c.topic}-${i}`} delay={i * 0.05}>
            <article className="panel spot contra-card" onMouseMove={spot}>
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
