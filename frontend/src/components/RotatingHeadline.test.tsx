import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROTATING_TOPICS, RotatingHeadline } from './RotatingHeadline'

describe('RotatingHeadline', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('has 20 short, sentence-ending topics', () => {
    expect(ROTATING_TOPICS).toHaveLength(20)
    for (const t of ROTATING_TOPICS) {
      expect(t.length).toBeLessThanOrEqual(11)
      expect(t.endsWith('.')).toBe(true)
    }
    expect(ROTATING_TOPICS).toEqual(expect.arrayContaining(['climate.', 'elections.', 'data hubs.']))
  })

  it('shows the first topic under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {},
    }))
    act(() => root.render(<RotatingHeadline />))
    expect(container.querySelector('.rot-word')?.textContent).toBe('Taiwan.')
  })
})
