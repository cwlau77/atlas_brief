import { useEffect, useState } from 'react'
import { AskForm } from '../components/AskForm'
import { Contours, type ContourCenter } from '../components/Contours'
import { RotatingHeadline } from '../components/RotatingHeadline'
import { Globe } from '../globe/Globe'
import { markIntroPlayed, shouldPlayIntro } from '../lib/intro'
import { useClock } from '../lib/useClock'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { useTypewriter } from '../lib/useTypewriter'
import { useSettings } from '../state/hooks'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import './home.css'

const SUGGESTIONS = ['Red Sea shipping', 'Data centers and privacy', 'Chip export controls', 'Climate finance']
const PROMPTS = ['about the Strait of Hormuz', 'about lithium supply in the Andes', 'about the ECB rate decision', 'about Sudan’s ceasefire talks'] as const
const CONTOURS: ContourCenter[] = [
  { x: 0.74, y: 0.48, rings: 22, step: 26, seed: 1.7 },
  { x: 0.08, y: 1.02, rings: 14, step: 30, seed: 4.1 },
]
const INTRO_MS = 2600

export function HomePage() {
  const reduced = usePrefersReducedMotion()
  const { settings } = useSettings()
  const clock = useClock(settings.timeZone, 15_000)
  const { generate, retry, loading, error } = useGenerateBriefing()
  const [intro, setIntro] = useState(() => shouldPlayIntro(reduced))
  const placeholder = useTypewriter(PROMPTS, { enabled: !reduced, pauseWhenFocusedId: 'home-ask' })

  useEffect(() => {
    if (!intro) return
    const end = () => {
      markIntroPlayed()
      setIntro(false)
    }
    const t = window.setTimeout(end, INTRO_MS)
    window.addEventListener('pointerdown', end, { once: true })
    window.addEventListener('keydown', end, { once: true })
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', end)
      window.removeEventListener('keydown', end)
      markIntroPlayed()
    }
  }, [intro])

  return (
    <section className={`home ${intro ? 'intro' : ''}`}>
      <Contours centers={CONTOURS} />
      <div className="home-inner wrap">
        <div className="home-copy">
          <p className="eyebrow label"><span>{clock.day}</span><span>{clock.time}</span><span>Global intelligence</span></p>
          <RotatingHeadline />
          <p className="home-lede">
            Atlas searches up to thirteen news sources and 26 newsroom feeds, then tells you{' '}
            <em className="serif">what changed, where it happened,</em> and what to read next.
          </p>
          <div className="home-ask">
            <AskForm id="home-ask" loading={loading} error={error} onGenerate={generate} onRetry={retry} placeholder={placeholder} />
            <div className="chips" aria-label="Suggested topics">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void generate(s, 'daily')} disabled={loading} data-cursor="link">
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="provenance label">
            <span>Google News</span><span>NewsAPI</span><span>GDELT 2.0</span><span>26 newsroom feeds</span><span>Model-written, source-cited</span>
          </p>
        </div>
        <div className="home-globe">
          <Globe
            mode="hero"
            playIntro={intro}
            scanning={loading}
            label="A globe of the world drawn in fine grain, slowly turning."
          />
        </div>
      </div>
    </section>
  )
}
