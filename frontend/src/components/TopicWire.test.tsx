import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRENDING_CACHE_KEY } from '../lib/trending'
import { TopicWire } from './TopicWire'

const FALLBACK = ['Red Sea shipping', 'Climate finance']
const TEN_MIN = 10 * 60_000

const ITEMS = [
  { topic: 'FAA clears 737 MAX 10', published_at: '2026-10-21T08:41:00Z' },
  { topic: 'ECB holds rates at 2%', published_at: '2026-10-21T09:28:00Z' },
  { topic: 'Sudan talks resume in Jeddah', published_at: '2026-10-21T07:05:00Z' },
  { topic: 'Chile caps lithium exports', published_at: '2026-10-21T09:10:00Z' },
  { topic: 'Taiwan drills near Kinmen', published_at: '2026-10-21T06:30:00Z' },
  { topic: 'Kenya floods displace thousands', published_at: '2026-10-21T05:15:00Z' },
]
const BODY = { topics: ITEMS.map((i) => i.topic), items: ITEMS, generated_at: '2026-10-21T09:42:00Z' }

describe('TopicWire', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'))
    sessionStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    delete (document as { visibilityState?: unknown }).visibilityState
  })

  const respond = (body: unknown, ok = true) => {
    const fetch = vi.fn(async () => ({ ok, json: async () => body }))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }
  const render = async (props: { onPick?: (t: string) => void; disabled?: boolean } = {}) => {
    const onPick = props.onPick ?? vi.fn()
    await act(async () => {
      root.render(<TopicWire fallback={FALLBACK} timeZone="UTC" onPick={onPick} disabled={props.disabled} />)
    })
    return onPick
  }
  const advance = async (ms: number) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  }
  const lines = () => [...container.querySelectorAll<HTMLButtonElement>('button.wire-line')]
  const topics = () => lines().map((b) => b.querySelector('.wire-topic')?.textContent)
  const newTopics = () => lines().filter((b) => b.classList.contains('is-new')).map((b) => b.querySelector('.wire-topic')?.textContent)
  const list = () => container.querySelector('ul.wire-list')!

  it('shows timed lines newest first, the Updated stamp, and at most five lines', async () => {
    respond(BODY)
    await render()
    expect(lines()).toHaveLength(5)
    expect(topics()[0]).toBe('ECB holds rates at 2%')
    expect(container.querySelector('.wire-time')?.textContent).toBe('09:28')
    expect(container.querySelector('.wire-time')?.classList.contains('mono')).toBe(true)
    expect(container.querySelector('.wire-updated')?.textContent).toBe('Updated 09:42')
    expect(container.querySelector('.wire-label')?.textContent).toBe('On the wire')
    expect(list().getAttribute('aria-label')).toBe('On the wire')
    expect(container.querySelector('.wire')?.classList.contains('wire-live')).toBe(true)
    expect(container.querySelector('.wire-mark')).not.toBeNull()
    expect(topics()).not.toContain('Kenya floods displace thousands')
  })

  it('paints the live list on the very first render when the session copy is fresh', async () => {
    const items = ITEMS.map((i) => ({ topic: i.topic, publishedAt: i.published_at }))
    sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ items, generatedAt: BODY.generated_at, at: Date.now() }))
    const fetch = respond(BODY)
    act(() => {
      root.render(<TopicWire fallback={FALLBACK} timeZone="UTC" onPick={vi.fn()} />)
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(container.querySelector('.wire-label')?.textContent).toBe('On the wire')
    expect(topics()[0]).toBe('ECB holds rates at 2%')
    expect(lines()).toHaveLength(5)
    expect(newTopics()).toEqual([])
    await advance(0)
    expect(newTopics()).toEqual([])
    expect(topics()[0]).toBe('ECB holds rates at 2%')
  })

  it('leaves the time blank for undated topics', async () => {
    respond({ topics: ['Undated topic'], items: [{ topic: 'Undated topic', published_at: null }], generated_at: '2026-10-21T09:42:00Z' })
    await render()
    const time = container.querySelector('.wire-time')
    expect(time).not.toBeNull()
    expect(time?.textContent).toBe('')
    expect(lines()[0].getAttribute('aria-label')).toBe('Brief me on Undated topic')
  })

  it('falls back to the suggestions, labelled Suggested, with no times or stamp', async () => {
    respond({ topics: [], items: [] })
    await render()
    expect(topics()).toEqual(FALLBACK)
    expect(container.querySelector('.wire-label')?.textContent).toBe('Suggested')
    expect(list().getAttribute('aria-label')).toBe('Suggested topics')
    expect(container.querySelector('.wire-updated')).toBeNull()
    expect(container.querySelector('.wire-live')).toBeNull()
    expect(container.querySelector('.wire-mark')).toBeNull()
    expect([...container.querySelectorAll('.wire-time')].map((t) => t.textContent)).toEqual(['', ''])
    act(() => root.unmount())
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('asleep') }))
    await render()
    expect(topics()).toEqual(FALLBACK)
  })

  it('briefs on the clicked line and names it for screen readers', async () => {
    respond(BODY)
    const onPick = await render()
    const line = lines().find((b) => b.querySelector('.wire-topic')?.textContent === 'FAA clears 737 MAX 10')!
    expect(line.getAttribute('aria-label')).toBe('Brief me on FAA clears 737 MAX 10, 08:41')
    expect(line.getAttribute('type')).toBe('button')
    expect(line.closest('li')).not.toBeNull()
    expect(line.querySelector('.wire-go')?.getAttribute('aria-hidden')).toBe('true')
    act(() => line.click())
    expect(onPick).toHaveBeenCalledWith('FAA clears 737 MAX 10')
  })

  it('disables every line while a briefing loads', async () => {
    respond(BODY)
    await render({ disabled: true })
    expect(lines().every((b) => b.disabled)).toBe(true)
  })

  it('does not refetch while the session copy is fresh', async () => {
    const fetch = respond(BODY)
    await render()
    await advance(TEN_MIN)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('picks up a new list after the session copy expires and marks only new lines', async () => {
    respond(BODY)
    await render()
    sessionStorage.removeItem(TRENDING_CACHE_KEY)
    const fresh = { topic: 'Peru declares state of emergency', published_at: '2026-10-21T11:50:00Z' }
    const fetch = respond({ ...BODY, items: [fresh, ...ITEMS], generated_at: '2026-10-21T11:55:00Z' })
    await advance(TEN_MIN)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(topics()[0]).toBe('Peru declares state of emergency')
    expect(container.querySelector('.wire-updated')?.textContent).toBe('Updated 11:55')
    expect(newTopics()).toEqual(['Peru declares state of emergency'])
    await advance(1600)
    expect(newTopics()).toEqual([])
  })

  it('marks nothing on first load or when the refreshed list is unchanged', async () => {
    respond(BODY)
    await render()
    expect(newTopics()).toEqual([])
    sessionStorage.removeItem(TRENDING_CACHE_KEY)
    const fetch = respond(BODY)
    await advance(TEN_MIN)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(newTopics()).toEqual([])
  })

  it('keeps the current lines when a refresh fails', async () => {
    respond(BODY)
    await render()
    const before = topics()
    sessionStorage.removeItem(TRENDING_CACHE_KEY)
    const fetch = vi.fn(async () => { throw new Error('asleep') })
    vi.stubGlobal('fetch', fetch)
    await advance(TEN_MIN)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(topics()).toEqual(before)
    expect(list().getAttribute('aria-label')).toBe('On the wire')
  })

  it('does not check while the tab is hidden', async () => {
    respond(BODY)
    await render()
    sessionStorage.removeItem(TRENDING_CACHE_KEY)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    const fetch = respond(BODY)
    await advance(TEN_MIN)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await advance(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('checks again when the tab becomes visible', async () => {
    respond(BODY)
    await render()
    sessionStorage.removeItem(TRENDING_CACHE_KEY)
    const fetch = respond(BODY)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
