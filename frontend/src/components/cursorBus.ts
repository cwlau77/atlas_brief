// Tiny pub/sub so the globe can feed live coordinates to the cursor
// without re-rendering React on every frame.
type Listener = (text: string | null) => void

const listeners = new Set<Listener>()
let current: string | null = null

export function setGlobeReadout(text: string | null): void {
  if (text === current) return
  current = text
  for (const l of listeners) l(text)
}

export function subscribeGlobeReadout(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}
