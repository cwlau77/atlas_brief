import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRENDING_CACHE_KEY } from '../lib/trending'
import { TopicChips } from './TopicChips'

const FALLBACK = ['Red Sea shipping', 'Climate finance']

describe('TopicChips', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    sessionStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  const respond = (body: unknown, ok = true) => {
    const fetch = vi.fn(async () => ({ ok, json: async () => body }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  const render = async (onPick = vi.fn()) => {
    await act(async () => { root.render(<TopicChips fallback={FALLBACK} onPick={onPick} />) })
    return onPick
  }
  const chips = () => [...container.querySelectorAll('button.chip')].map((b) => b.textContent)
  const group = () => container.querySelector('[role="group"]')!

  it('swaps the fixed suggestions for trending topics once they arrive', async () => {
    const fetch = respond({ topics: ['Gaza ceasefire talks', 'ECB interest rates'] })
    const onPick = await render()
    expect(fetch).toHaveBeenCalledWith('/api/trending', expect.anything())
    expect(chips()).toEqual(['Gaza ceasefire talks', 'ECB interest rates'])
    expect(group().getAttribute('aria-label')).toBe('Trending now')
    expect(container.querySelector('.chips-label')?.textContent).toBe('Trending now')
    act(() => (container.querySelector('button.chip') as HTMLButtonElement).click())
    expect(onPick).toHaveBeenCalledWith('Gaza ceasefire talks')
  })

  it('keeps the fixed suggestions when trending is empty or fails', async () => {
    respond({ topics: [] })
    await render()
    expect(chips()).toEqual(FALLBACK)
    expect(group().getAttribute('aria-label')).toBe('Suggested topics')
    expect(container.querySelector('.chips-label')).toBeNull()
    act(() => root.unmount())
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('asleep') }))
    await render()
    expect(chips()).toEqual(FALLBACK)
  })

  it('reuses topics fetched in the last half hour of this session', async () => {
    sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ topics: ['Cached topic'], at: Date.now() }))
    const fetch = respond({ topics: ['Fresh topic'] })
    await render()
    expect(chips()).toEqual(['Cached topic'])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ignores a stale or malformed cache', async () => {
    sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ topics: ['Old'], at: Date.now() - 31 * 60_000 }))
    respond({ topics: ['Fresh topic', 42] })
    await render()
    expect(chips()).toEqual(['Fresh topic'])
  })
})
