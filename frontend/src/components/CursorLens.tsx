import { useEffect, useRef } from 'react'
import { useMediaQuery, usePrefersReducedMotion } from '../lib/useMediaQuery'
import { subscribeGlobeReadout } from './cursorBus'
import './cursor.css'

const INTERACTIVE = '[data-cursor], a, button, input, select, textarea, label'

/** A terracotta dot and trailing ring that adapts to what's under the pointer. */
export function CursorLens() {
  const reduced = usePrefersReducedMotion()
  const fine = useMediaQuery('(pointer: fine)')
  const enabled = fine && !reduced
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const readRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dot = dotRef.current, ring = ringRef.current, read = readRef.current
    if (!enabled || !dot || !ring || !read) return
    const root = document.documentElement
    root.classList.add('has-cursor')
    let x = -100, y = -100, rx = -100, ry = -100
    let inside = false
    let mode = ''
    let readout: string | null = null
    let raf = 0

    const setMode = (m: string) => {
      if (m === mode) return
      mode = m
      if (m) root.dataset.cursor = m
      else delete root.dataset.cursor
    }
    const pick = (target: EventTarget | null): string => {
      const el = (target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null
      if (!el) return readout ? 'globe' : ''
      if (el.dataset.cursor) return el.dataset.cursor
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? 'text' : 'link'
    }
    const show = (on: boolean) => {
      for (const el of [dot, ring, read]) el.classList.toggle('hidden', !on)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      x = e.clientX
      y = e.clientY
      if (!inside) {
        inside = true
        rx = x
        ry = y
        show(true)
      }
      setMode(pick(e.target))
    }
    const onLeave = () => {
      inside = false
      show(false)
    }
    const unsubscribe = subscribeGlobeReadout((text) => {
      readout = text
      read.textContent = text ?? ''
      if (text && !mode) setMode('globe')
      if (!text && mode === 'globe') setMode('')
    })
    const loop = () => {
      rx += (x - rx) * 0.2
      ry += (y - ry) * 0.2
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      read.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      unsubscribe()
      window.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.classList.remove('has-cursor')
      delete root.dataset.cursor
    }
  }, [enabled])

  if (!enabled) return null
  return (
    <>
      <div ref={ringRef} className="cur cur-ring hidden" aria-hidden="true" />
      <div ref={dotRef} className="cur cur-dot hidden" aria-hidden="true" />
      <div ref={readRef} className="cur cur-read label hidden" aria-hidden="true" />
    </>
  )
}
