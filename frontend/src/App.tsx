import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
import { NavBar } from './components/NavBar'
import { ToastHost } from './components/Toast'
import { warmBackend } from './lib/api'
import { useRouteFocus } from './lib/useRouteFocus'
import { ArchivePage } from './routes/ArchivePage'
import { BriefingLayout } from './routes/BriefingLayout'
import { HomePage } from './routes/HomePage'
import { NotFound } from './routes/NotFound'
import { SettingsPage } from './routes/SettingsPage'
import { SignalsTab } from './routes/SignalsTab'
import { StoryTab } from './routes/StoryTab'
import { AppStateProvider } from './state/AppState'
import { useAppState } from './state/hooks'
import './app.css'

function Shell() {
  useRouteFocus()
  useEffect(() => warmBackend(), [])
  const { toasts, dismissToast } = useAppState()
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <NavBar />
      <main id="main" className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/brief/:id" element={<BriefingLayout />}>
            <Route index element={<StoryTab />} />
            <Route path="signals" element={<SignalsTab />} />
          </Route>
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="wrap">
          <span>Atlas Brief · NewsAPI, GDELT and fifteen wire services</span>
          <span>Analysis is model-written. Check it against the cited sources.</span>
        </div>
      </footer>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}
