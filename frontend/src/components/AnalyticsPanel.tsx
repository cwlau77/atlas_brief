import { useEffect, useRef, useState } from 'react'
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart,
  DoughnutController, Legend, LinearScale, Tooltip,
} from 'chart.js'
import { useInView, useReducedMotion } from 'framer-motion'
import type { SavedBriefing } from '../lib/normalize'
import { useSpotlight } from '../lib/useSpotlight'
import { Reveal } from './Reveal'
import './analytics.css'

Chart.register(ArcElement, BarController, BarElement, CategoryScale,
  DoughnutController, Legend, LinearScale, Tooltip)

Chart.defaults.font.family = "'Geist', sans-serif"
Chart.defaults.color = '#9ba3ad'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  newsapi: 'NewsAPI',
  gdelt: 'GDELT',
  rss: 'RSS Feeds',
}

// Signal-first: chartreuse leads, severity + haze hues follow.
const PALETTE = ['#c6f135', '#5cc8ff', '#ffb454', '#8b7cf6', '#ff6b57', '#9ba3ad', '#56d6b6', '#a8cf2b']

function useDoughnut(breakdown: Record<string, number>) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const entries = Object.entries(breakdown).filter(([, v]) => v > 0)
    if (!entries.length) return
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: entries.map(([k]) => SOURCE_TYPE_LABELS[k] ?? k),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: PALETTE.slice(0, entries.length),
          borderColor: '#0b0d10',
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, padding: 14 } } },
      },
    })
    return () => chart.destroy()
  }, [breakdown])
  return ref
}

function useRegionBars(regionCounts: Record<string, number>) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const entries = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    if (!entries.length) return
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(([k]) => k),
        datasets: [{
          data: entries.map(([, v]) => v),
          backgroundColor: 'rgba(198, 241, 53, 0.85)',
          borderRadius: 4,
          barThickness: 12,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { grid: { display: false } },
        },
      },
    })
    return () => chart.destroy()
  }, [regionCounts])
  return ref
}

/** Tabular count-up on first scroll into view; instant under reduced motion. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (reduced || value === 0) {
      setShown(value)
      return
    }
    const start = performance.now()
    const duration = 800
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 4) // expo-ish out
      setShown(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, value])
  return <span ref={ref} className="stat-value mono">{shown}</span>
}

export function AnalyticsPanel({ briefing }: { briefing: SavedBriefing }) {
  const doughnutRef = useDoughnut(briefing.sourceBreakdown)
  const barsRef = useRegionBars(briefing.regionCounts)
  const spot = useSpotlight()
  const hasSources = Object.values(briefing.sourceBreakdown).some((v) => v > 0)
  const hasRegions = Object.keys(briefing.regionCounts).length > 0

  const stats: { label: string; value: number }[] = [
    { label: 'ARTICLES', value: briefing.stats.articles },
    { label: 'SOURCES', value: briefing.stats.sources },
    { label: 'REGIONS', value: briefing.stats.regions },
    { label: 'ALERTS', value: briefing.stats.alerts },
  ]

  return (
    <section className="brief-section" aria-labelledby="analytics-heading">
      <div className="signal-label" id="analytics-heading">
        <span className="label-index" aria-hidden>06</span> Signal analytics
      </div>
      <Reveal>
        <div className="stat-row">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile panel spot" onMouseMove={spot}>
              <CountUp value={s.value} />
              <span className="stat-label mono">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="chart-row">
          <div className="chart-box panel">
            <h3 className="chart-title">Source mix</h3>
            {hasSources
              ? <div className="chart-canvas"><canvas ref={doughnutRef} /></div>
              : <p className="chart-empty">No source data available for this briefing.</p>}
          </div>
          <div className="chart-box panel">
            <h3 className="chart-title">Most-mentioned regions</h3>
            {hasRegions
              ? <div className="chart-canvas"><canvas ref={barsRef} /></div>
              : <p className="chart-empty">No regional tags detected in this briefing.</p>}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
