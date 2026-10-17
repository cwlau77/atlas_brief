import { AskForm } from '../components/AskForm'
import { Globe } from '../globe/Globe'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import './home.css'

const SUGGESTIONS = ['Red Sea shipping', 'Sahel security', 'Chip export controls', 'Climate finance']

export function HomePage() {
  const { generate, retry, loading, error } = useGenerateBriefing()
  return (
    <section className="home">
      <div className="home-inner wrap">
        <div className="home-copy">
          <p className="eyebrow label"><span>Global intelligence</span></p>
          <h1 className="home-title">
            <span className="l1">Brief me on</span>
            <span className="rot"><span className="rot-word serif">anything.</span></span>
          </h1>
          <p className="home-lede">
            Atlas reads NewsAPI, GDELT and fifteen wire services, then tells you{' '}
            <em className="serif">what changed, where it happened,</em> and what to read next.
          </p>
          <div className="home-ask">
            <AskForm id="home-ask" loading={loading} error={error} onGenerate={generate} onRetry={retry} />
            <div className="chips" aria-label="Suggested topics">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void generate(s, 'daily')} disabled={loading} data-cursor="link">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="provenance label">
            <span>NewsAPI</span><span>GDELT 2.0</span><span>15 wire feeds</span><span>Model-written, source-cited</span>
          </p>
        </div>
        <div className="home-globe">
          <Globe
            mode="hero"
            scanning={loading}
            label="A globe of the world drawn in fine grain, slowly turning."
          />
        </div>
      </div>
    </section>
  )
}
