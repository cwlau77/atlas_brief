import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { AmbientBackdrop } from './components/AmbientBackdrop'
import { BriefingForm } from './components/BriefingForm'
import { BriefingView } from './components/BriefingView'
import { GlobeHero } from './components/GlobeHero'
import { NavBar, type Page } from './components/NavBar'
import { ProfilePage, loadSettings } from './components/ProfilePage'
import { SavedPage } from './components/SavedPage'
import { StandByClock } from './components/StandByClock'
import { ToastHost, type ToastItem } from './components/Toast'
import { requestBriefing, warmBackend } from './lib/api'
import { normalizeBriefing, type SavedBriefing } from './lib/normalize'
import { KEYS, loadJSON, saveJSON } from './lib/storage'
import './app.css'

const SUGGESTIONS = ['South Asian security', 'climate policy', 'global trade', 'migration', 'energy markets']

const heroTransition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }

let toastSeq = 0

export default function App() {
  const [page, setPage] = useState<Page>('briefing')
  const [current, setCurrent] = useState<SavedBriefing | null>(null)
  const [saved, setSaved] = useState<SavedBriefing[]>(() => loadJSON(KEYS.saved, []))
  const [starred, setStarred] = useState<string[]>(() => loadJSON(KEYS.starred, []))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => warmBackend(), [])

  const pushToast = (message: string, tone: ToastItem['tone'] = 'info', ttl = 3000) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, tone }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl)
  }

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  const storageFailureToast = () =>
    pushToast("Couldn't save locally — browser storage is full or disabled.", 'error', 4000)

  const persistSaved = (next: SavedBriefing[]) => {
    setSaved(next)
    if (!saveJSON(KEYS.saved, next)) storageFailureToast()
  }

  const persistStarred = (next: string[]) => {
    setStarred(next)
    if (!saveJSON(KEYS.starred, next)) storageFailureToast()
  }

  const fileBriefing = (briefing: SavedBriefing) => {
    // Replace any same-area entry, newest first, keep twelve (legacy behavior).
    persistSaved([briefing, ...saved.filter((b) => b.area !== briefing.area)].slice(0, 12))
  }

  const generate = async (focus: string, frequency: string) => {
    setLoading(true)
    setError(null)
    try {
      const api = await requestBriefing(focus, AbortSignal.timeout(120_000))
      const vm = normalizeBriefing(api, frequency)
      setCurrent(vm)
      if (loadSettings().autoSave) {
        fileBriefing(vm)
        pushToast('Briefing generated and filed in the archive', 'success', 2600)
      } else {
        pushToast('Briefing generated', 'success', 2200)
      }
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'TimeoutError'
        ? 'The request timed out. The free-tier backend may still be waking — please try again.'
        : err instanceof Error ? err.message : 'Something went wrong generating the briefing.'
      setError(message)
      pushToast(message, 'error', 4000)
    } finally {
      setLoading(false)
    }
  }

  const viewSaved = (b: SavedBriefing) => {
    setCurrent(b)
    setError(null)
    setPage('briefing')
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const toggleStar = (id: string) => {
    persistStarred(starred.includes(id) ? starred.filter((s) => s !== id) : [...starred, id])
  }

  const deleteBriefing = (id: string) => {
    if (!window.confirm('Remove this briefing from the archive?')) return
    persistSaved(saved.filter((b) => b.id !== id))
    persistStarred(starred.filter((s) => s !== id))
    pushToast('Briefing removed', 'info', 2000)
  }

  const printBriefing = (b: SavedBriefing) => {
    setCurrent(b)
    setPage('briefing')
    // Let the briefing render before invoking the print dialog.
    window.setTimeout(() => window.print(), 400)
  }

  // Docked once a briefing exists: the globe moves aside and content leads.
  const docked = current !== null

  // Globe hotspot dropdowns scroll to these anchors inside KeyDevelopments.
  const anchors = current
    ? current.keyDevelopments.map((d, i) => ({ headline: d.title, regions: d.regions, anchorId: `dev-${i}` }))
    : null

  return (
    <div className="app">
      <NavBar page={page} onNavigate={setPage} />

      {page === 'briefing' && (
        <>
          <section className={`hero ${docked ? 'hero-docked' : 'hero-standby'}`}>
            <AmbientBackdrop ring={!docked} />
            {/* No AnimatePresence here: exit-waiting deadlocks when the leaving
                subtree contains the lazy/Suspense globe. Keyed remounts give a
                clean animated entrance instead. */}
            {!docked ? (
                <motion.div
                  key="standby"
                  className="hero-inner hero-inner-standby"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={heroTransition}
                >
                  <div className="standby-stage">
                    <GlobeHero regionCounts={null} />
                    <div className="standby-overlay">
                      <StandByClock />
                      <p className="standby-kicker mono">GLOBAL INTELLIGENCE · ONE FOCUS PHRASE</p>
                    </div>
                  </div>
                  <div className="standby-console">
                    <BriefingForm loading={loading} onGenerate={generate} />
                    <div className="suggestion-row">
                      {SUGGESTIONS.map((s) => (
                        <button key={s} className="suggestion-chip mono" onClick={() => generate(s, 'daily')} disabled={loading}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="docked"
                  className="hero-inner hero-inner-docked"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={heroTransition}
                >
                  <div className="docked-copy">
                    <p className="hero-kicker mono">ATLAS BRIEF · LIVE SIGNAL</p>
                    <h1 className="hero-title">
                      Signal from noise, <em>mapped.</em>
                    </h1>
                    <BriefingForm loading={loading} onGenerate={generate} />
                    <p className="docked-hint mono">HOVER A SIGNAL POINT ON THE GLOBE FOR ITS STORIES</p>
                  </div>
                  <div className="docked-globe">
                    <GlobeHero regionCounts={current.regionCounts} developments={anchors} />
                  </div>
                </motion.div>
              )}
          </section>

          <main className="content" ref={resultsRef}>
            {error && (
              <div className="panel notice-card notice-error" role="alert">
                <h3>Unable to generate briefing</h3>
                <p>{error}</p>
              </div>
            )}
            {current && <BriefingView briefing={current} />}
          </main>
        </>
      )}

      {page === 'saved' && (
        <main className="content content-page">
          <SavedPage
            saved={saved}
            starredIds={starred}
            onView={viewSaved}
            onToggleStar={toggleStar}
            onDelete={deleteBriefing}
            onPrint={printBriefing}
          />
        </main>
      )}

      {page === 'profile' && (
        <main className="content content-page">
          <ProfilePage onStorageFailure={storageFailureToast} />
        </main>
      )}

      <footer className="footer">
        <span className="mono">ATLAS BRIEF</span> — synthesized from NewsAPI, GDELT, and a
        fifteen-wire source pool. Analysis is model-generated; verify against the cited sources.
      </footer>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
