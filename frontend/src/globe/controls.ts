import type { GlobeEngine } from './engine'

const SENSITIVITY = 0.005 // radians per pixel
const MAX_FLING = 6 // radians per second

/** Pointer-drag rotation with momentum. Returns a cleanup function. */
export function attachDrag(el: HTMLElement, engine: Pick<GlobeEngine, 'rotateBy' | 'release'>): () => void {
  let dragging = false
  let pointerId = -1
  let lastX = 0, lastY = 0, lastT = 0, vx = 0, vy = 0

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, .globe-panel')) return
    dragging = true
    pointerId = e.pointerId
    el.setPointerCapture(pointerId)
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now()
    vx = 0; vy = 0
    el.classList.add('dragging')
  }
  const move = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    const now = performance.now()
    const dt = Math.max(1, now - lastT) / 1000
    const dx = (e.clientX - lastX) * SENSITIVITY
    const dy = (e.clientY - lastY) * SENSITIVITY
    engine.rotateBy(dx, dy)
    vx = dx / dt; vy = dy / dt
    lastX = e.clientX; lastY = e.clientY; lastT = now
  }
  const up = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointerId) return
    dragging = false
    try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
    el.classList.remove('dragging')
    const stale = performance.now() - lastT > 80
    const clampFling = (v: number) => Math.max(-MAX_FLING, Math.min(MAX_FLING, v))
    engine.release(stale ? 0 : clampFling(vx), stale ? 0 : clampFling(vy))
  }

  el.addEventListener('pointerdown', down)
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  return () => {
    el.removeEventListener('pointerdown', down)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
}
