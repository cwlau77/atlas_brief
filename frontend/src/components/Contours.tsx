import { useEffect, useRef } from 'react'

export interface ContourCenter { x: number; y: number; rings: number; step: number; seed: number }

/** Faint topographic rings drawn once per resize. Decorative. */
export function Contours({ centers }: { centers: ContourCenter[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      const g = canvas.getContext('2d')
      if (!g) return
      g.scale(dpr, dpr)
      g.lineWidth = 1
      for (const c of centers) {
        const cx = r.width * c.x, cy = r.height * c.y
        for (let k = 1; k <= c.rings; k++) {
          const base = k * c.step
          g.strokeStyle = `rgba(61, 90, 69, ${k % 5 === 0 ? 0.16 : 0.075})`
          g.beginPath()
          for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) {
            const w = Math.sin(a * 3 + c.seed + k * 0.21) * 0.07 + Math.sin(a * 5 - c.seed * 1.3 + k * 0.13) * 0.035 + Math.sin(a * 2 + k * 0.4) * 0.05
            const rad = base * (1 + w)
            const x = cx + Math.cos(a) * rad * 1.18, y = cy + Math.sin(a) * rad
            if (a === 0) g.moveTo(x, y)
            else g.lineTo(x, y)
          }
          g.closePath()
          g.stroke()
        }
      }
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [centers])
  return <canvas ref={ref} className="contours" aria-hidden="true" />
}
