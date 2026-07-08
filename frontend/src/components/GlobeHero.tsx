import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { DevelopmentAnchor } from './GlobeCanvas'
import { CompassIcon } from './icons'
import './globehero.css'

const GlobeCanvas = lazy(() => import('./GlobeCanvas'))

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width: Math.round(width), height: Math.round(height) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, size }
}

function GlobeFallback() {
  return (
    <div className="globe-fallback" aria-hidden>
      <CompassIcon size={64} className="globe-fallback-compass" />
      <span className="mono globe-fallback-label">ACQUIRING SIGNAL…</span>
    </div>
  )
}

export function GlobeHero({ regionCounts, developments = null }: {
  regionCounts: Record<string, number> | null
  developments?: DevelopmentAnchor[] | null
}) {
  const { ref, size } = useContainerSize()
  return (
    <div className="globe-stage" ref={ref} data-w={size.width} data-h={size.height} role="img"
      aria-label={regionCounts && Object.keys(regionCounts).length > 0
        ? `Interactive globe showing news activity across ${Object.keys(regionCounts).length} regions — hover a signal point for its stories`
        : 'Interactive globe awaiting a briefing'}>
      {size.width > 0 && (
        <Suspense fallback={<GlobeFallback />}>
          <GlobeCanvas width={size.width} height={size.height} regionCounts={regionCounts} developments={developments} />
        </Suspense>
      )}
    </div>
  )
}
