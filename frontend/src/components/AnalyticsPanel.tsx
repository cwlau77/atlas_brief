import { useEffect, useRef } from 'react'
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart,
  DoughnutController, Legend, LinearScale, Tooltip,
} from 'chart.js'
import type { SavedBriefing } from '../lib/normalize'
import { SignalIcon } from './icons'
import { Reveal } from './Reveal'
import './analytics.css'

Chart.register(ArcElement, BarController, BarElement, CategoryScale,
  DoughnutController, Legend, LinearScale, Tooltip)

Chart.defaults.font.family = "'Libre Franklin', sans-serif"
Chart.defaults.color = '#5b6b83'

const SOURCE_TYPE_LABELS: Record<string, string> = {
  newsapi: 'NewsAPI',
  gdelt: 'GDELT',
  rss: 'RSS Feeds',
}

const PALETTE = ['#16233a', '#b04a2e', '#256d63', '#a97e2f', '#2f6f8f', '#5b6b83', '#8f3a23', '#2f877a']

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
          borderColor: '#faf6ec',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } } },
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
          backgroundColor: '#b04a2e',
          borderRadius: 3,
          barThickness: 14,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { precision: 0 }, grid: { color: 'rgba(217,205,180,0.45)' } },
          y: { grid: { display: false } },
        },
      },
    })
    return () => chart.destroy()
  }, [regionCounts])
  return ref
}

export function AnalyticsPanel({ briefing }: { briefing: SavedBriefing }) {
  const doughnutRef = useDoughnut(briefing.sourceBreakdown)
  const barsRef = useRegionBars(briefing.regionCounts)
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
      <div className="plate-label" id="analytics-heading">
        <SignalIcon size={13} /> Signal analytics
      </div>
      <Reveal>
        <div className="stat-row">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile card">
              <span className="stat-value mono">{s.value}</span>
              <span className="stat-label mono">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="chart-row">
          <div className="chart-box card">
            <h3 className="chart-title">Source mix</h3>
            {hasSources
              ? <div className="chart-canvas"><canvas ref={doughnutRef} /></div>
              : <p className="chart-empty">No source data available for this briefing.</p>}
          </div>
          <div className="chart-box card">
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
