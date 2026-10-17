import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  window.sessionStorage.clear()
  vi.resetModules()
})

describe('intro', () => {
  it('plays once per browser session', async () => {
    const first = await import('./intro')
    expect(first.shouldPlayIntro(false)).toBe(true)
    expect(first.shouldPlayIntro(false)).toBe(true) // stable within one page load until marked
    first.markIntroPlayed()
    expect(first.shouldPlayIntro(false)).toBe(false)
    vi.resetModules()
    const reloaded = await import('./intro')
    expect(reloaded.shouldPlayIntro(false)).toBe(false)
  })
  it('never plays with reduced motion', async () => {
    const m = await import('./intro')
    expect(m.shouldPlayIntro(true)).toBe(false)
  })
})
