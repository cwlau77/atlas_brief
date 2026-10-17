import { Suspense, lazy } from 'react'
import { useBriefing } from './briefingContext'

// chart.js stays out of the entry chunk until Task 11 replaces this panel.
const AnalyticsPanel = lazy(() => import('../components/AnalyticsPanel').then((m) => ({ default: m.AnalyticsPanel })))

export function SignalsTab() {
  const briefing = useBriefing()
  return (
    <div className="signals wrap">
      <Suspense fallback={null}>
        <AnalyticsPanel briefing={briefing} />
      </Suspense>
    </div>
  )
}
