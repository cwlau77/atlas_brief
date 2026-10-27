import { useEffect, useRef, useState } from 'react'
import { AskForm } from '../components/AskForm'
import { Contours, type ContourCenter } from '../components/Contours'
import { HomeLede } from '../components/HomeLede'
import { HowAtlasReads } from '../components/HowAtlasReads'
import { LoadingLedger } from '../components/LoadingLedger'
import { RotatingHeadline } from '../components/RotatingHeadline'
import { TopicWire } from '../components/TopicWire'
import { Globe } from '../globe/Globe'
import { findPlaceIn, resolveRegion } from '../lib/centroids'
import { markIntroPlayed, shouldPlayIntro } from '../lib/intro'
import { liveServiceCount, useSources } from '../lib/sources'
import { useClock } from '../lib/useClock'
import { useFocusOnArrival } from '../lib/useFocusOnArrival'
import { usePrefersReducedMotion } from '../lib/useMediaQuery'
import { useTypewriter } from '../lib/useTypewriter'
import { useAppState } from '../state/hooks'
import { useGenerateBriefing } from '../state/useGenerateBriefing'
import './home.css'

const SUGGESTIONS = ['Red Sea shipping', 'Data centers and privacy', 'Chip export controls', 'Climate finance']
const PROMPTS = ['about the Strait of Hormuz', 'about lithium supply in the Andes', 'about the ECB rate decision', 'about Sudan’s ceasefire talks'] as const
const CONTOURS: ContourCenter[] = [
  { x: 0.74, y: 0.48, rings: 22, step: 26, seed: 1.7 },
  { x: 0.08, y: 1.02, rings: 14, step: 30, seed: 4.1 },
]
const INTRO_MS = 2600
// How long Home's copy takes to leave before the ledger has the column to itself.
const COPY_EXIT_MS = 250

export function HomePage() {
  const reduced = usePrefersReducedMotion()
  const { settings } = useAppState()
  const sources = useSources()
  const clock = useClock(settings.timeZone, 15_000)
  const { generate, retry, cancel, loading, error, ledger } = useGenerateBriefing()
  useFocusOnArrival('home-ask')
  const [prefill, setPrefill] = useState<{ text: string; n: number }>()
  const [intro, setIntro] = useState(() => shouldPlayIntro(reduced))
  const placeholder = useTypewriter(PROMPTS, { enabled: !reduced, pauseWhenFocusedId: 'home-ask' })
  const loadingScreen = loading && ledger !== null
  // The copy stays a moment after loading starts so it can fade out under the ledger.
  const [copyLeaving, setCopyLeaving] = useState(false)
  const [wasLoading, setWasLoading] = useState(loadingScreen)
  if (wasLoading !== loadingScreen) {
    setWasLoading(loadingScreen)
    setCopyLeaving(loadingScreen && !reduced)
  }
  // A run that ends here (cancel, Back or an error) gives focus back to the ask box.
  const loadedBefore = useRef(false)
  useEffect(() => {
    if (loadingScreen) {
      loadedBefore.current = true
      return
    }
    if (!loadedBefore.current) return
    loadedBefore.current = false
    if (document.activeElement === document.body) document.getElementById('home-ask')?.focus({ preventScroll: true })
  }, [loadingScreen])
  useEffect(() => {
    if (!copyLeaving) return
    const t = window.setTimeout(() => setCopyLeaving(false), COPY_EXIT_MS)
    return () => window.clearTimeout(t)
  }, [copyLeaving])

  // The ask box unmounts while loading; seeding it with the focus keeps the text for a retry.
  const start = (focus: string, frequency: string) => {
    setPrefill((p) => ({ text: focus, n: (p?.n ?? 0) + 1 }))
    void generate(focus, frequency)
  }
  const labels = Object.fromEntries((sources?.services ?? []).map((s) => [s.name, s.label]))
  // Fly only once the plan has named (or failed to name) a place, never on a guess from the focus alone.
  const globeLoading = loadingScreen && ledger.plan
    ? {
        target: resolveRegion(ledger.plan.place ?? '') ?? (ledger.plan.place ? findPlaceIn(ledger.focus) : null),
        feedOutlets: Object.keys(ledger.feedOutlets),
      }
    : undefined

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
    <section className={`home ${intro ? 'intro' : ''} ${loadingScreen ? 'home-loading' : ''}`}>
      <Contours centers={CONTOURS} />
      <div className="home-inner wrap">
        <div className="home-left">
          {loadingScreen && <LoadingLedger ledger={ledger} labels={labels} reduced={reduced} onCancel={cancel} />}
          {(!loadingScreen || copyLeaving) && (
            <div className={`home-copy ${copyLeaving ? 'home-copy-leaving' : ''}`} aria-hidden={copyLeaving || undefined} inert={copyLeaving || undefined}>
              <p className="eyebrow label"><span>{clock.day}</span><span>{clock.time}</span><span>Global intelligence</span></p>
              <RotatingHeadline />
              <HomeLede />
              <div className="home-ask">
                <AskForm id="home-ask" loading={loading} error={error} onGenerate={start} onRetry={retry} placeholder={placeholder} prefill={prefill} />
                <TopicWire fallback={SUGGESTIONS} timeZone={settings.timeZone} onPick={(t) => start(t, 'daily')} disabled={loading} />
              </div>
              <p className="provenance label">
                <span>{sources ? `${liveServiceCount(sources)} news services` : 'News services'}</span>
                <span>{sources ? `${sources.feeds.count} newsroom feeds` : 'Newsroom feeds'}</span>
                <span>Model-written, source-cited</span>
                <a href="#how-atlas-reads" onClick={(e) => {
                  const target = document.getElementById('how-atlas-reads')
                  if (!target) return
                  e.preventDefault()
                  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
                }}>How Atlas reads ↓</a>
              </p>
            </div>
          )}
        </div>
        <div className="home-globe">
          <Globe
            mode="hero"
            playIntro={intro}
            scanning={loading}
            loading={globeLoading}
            label="A globe of the world drawn in fine grain, slowly turning."
          />
          {loadingScreen && <p className="home-globe-hint label">Drag to look around. Your briefing opens when it's ready.</p>}
        </div>
      </div>
      <HowAtlasReads info={sources} />
    </section>
  )
}
