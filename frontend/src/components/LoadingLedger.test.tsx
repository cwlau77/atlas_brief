import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialLedger, reduceLedger, type LedgerAction, type LedgerState } from '../lib/ledger'
import { LoadingLedger } from './LoadingLedger'

const SOURCES = ['newsapi', 'gdelt', 'rss', 'google_news', 'guardian', 'gnews', 'newsdata', 'tavily', 'exa']
const LABELS = { guardian: 'The Guardian', gdelt: 'GDELT 2.0', newsapi: 'NewsAPI', tavily: 'Tavily', exa: 'Exa' }
const ledgerOf = (actions: LedgerAction[]): LedgerState => actions.reduce(reduceLedger, initialLedger('Sudan ceasefire talks'))
const plan = (place: string | null): LedgerAction => ({ type: 'plan', place, queries: 5, is_finance: false, sources: SOURCES })
const outlets = (n: number, prefix: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, 1]))

describe('LoadingLedger', () => {
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
  })
  const render = (ledger: LedgerState, { reduced = false, onCancel = vi.fn() } = {}) =>
    act(() => root.render(<LoadingLedger ledger={ledger} labels={LABELS} reduced={reduced} onCancel={onCancel} />))
  const text = () => (container.textContent ?? '').replace(/\s+/g, ' ')
  const grid = () => [...container.querySelectorAll('.ledger-sources li')].map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())

  it('heads with the kicker and the focus', () => {
    render(ledgerOf([]))
    expect(container.querySelector('.ledger-kicker')?.textContent).toBe('Preparing your briefing')
    expect(container.querySelector('h1')?.textContent).toBe('Sudan ceasefire talks')
  })

  it('names the place and query count, or the count alone', () => {
    render(ledgerOf([plan('Sudan')]))
    expect(text()).toContain('Sudan · 5 queries')
    render(ledgerOf([plan(null)]))
    expect(text()).toContain('5 queries')
    expect(text()).not.toContain('· 5 queries')
  })

  it('tallies sources as they come in, one grid line each', () => {
    render(ledgerOf([
      plan('Sudan'),
      { type: 'source', name: 'rss', count: 6, status: 'ok', outlets: outlets(6, 'feed') },
      { type: 'source', name: 'guardian', count: 34, status: 'ok', outlets: outlets(6, 'g') },
    ]))
    expect(text()).toContain('2 of 9 sources in · 40 articles from 12 outlets')
    expect(grid()).toContain('Newsroom feeds 6')
    expect(grid()).toContain('The Guardian 34')
    expect(grid()).toContain('GDELT 2.0 …')
  })

  it('says when a source had nothing or ran out of time', () => {
    render(ledgerOf([
      plan('Sudan'),
      { type: 'source', name: 'newsapi', count: 0, status: 'empty', outlets: {} },
      { type: 'source', name: 'tavily', count: 0, status: 'timeout', outlets: {} },
      { type: 'source', name: 'exa', count: 0, status: 'deadline', outlets: {} },
    ]))
    expect(grid()).toEqual(expect.arrayContaining(['NewsAPI no results', 'Tavily timed out', 'Exa timed out']))
  })

  it('shows the ranking, then ticks off each section', () => {
    const ranked = ledgerOf([plan('Sudan'), { type: 'ranked', merged: 214, deduped: 190, kept: 58, outlets: 63 }, { type: 'section', name: 'developments' }])
    render(ranked)
    expect(text()).toContain('214 → 58 kept')
    expect(container.querySelector('[data-section="developments"]')?.getAttribute('data-done')).toBe('true')
    expect(container.querySelector('[data-section="signals"]')?.getAttribute('data-done')).toBe('false')
    render(reduceLedger(reduceLedger(ranked, { type: 'section', name: 'signals' }), { type: 'section', name: 'alerts' }))
    expect(text()).toContain('Adding context and photos…')
  })

  it('lists Trends, ticks it on its event, and finishes writing without it', () => {
    const core = ledgerOf([plan('Sudan'), { type: 'ranked', merged: 9, deduped: 9, kept: 9, outlets: 3 }, { type: 'section', name: 'developments' }])
    render(core)
    expect(container.querySelector('[data-section="outlook"]')?.textContent).toBe('Trends')
    render(reduceLedger(core, { type: 'section', name: 'outlook' }))
    expect(container.querySelector('[data-section="outlook"]')?.getAttribute('data-done')).toBe('true')
    // An older backend never sends outlook: the core three are enough.
    render(reduceLedger(reduceLedger(core, { type: 'section', name: 'signals' }), { type: 'section', name: 'alerts' }))
    expect(text()).toContain('Adding context and photos…')
  })

  it('shows the cold-start note only while the backend wakes', () => {
    render(ledgerOf([]))
    expect(text()).not.toContain('Waking the backend')
    render(ledgerOf([{ type: 'cold' }]))
    expect(text()).toContain('Waking the backend. Free hosting sleeps when idle, so this can take up to a minute…')
  })

  it('shows working rows when the stream is unavailable', () => {
    render(ledgerOf([{ type: 'fallback' }]))
    expect(container.querySelectorAll('.ledger-row .ledger-detail')[0]?.textContent).toBe('Working…')
  })

  it('cancels', () => {
    const onCancel = vi.fn()
    render(ledgerOf([]), { onCancel })
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!
    act(() => button.click())
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('drops its rows in only with motion allowed', () => {
    render(ledgerOf([]))
    expect(container.querySelector('.ledger')?.classList.contains('ledger-enter')).toBe(true)
    render(ledgerOf([]), { reduced: true })
    expect(container.querySelector('.ledger')?.classList.contains('ledger-enter')).toBe(false)
  })

  it('takes focus on its heading and announces each stage once', () => {
    render(ledgerOf([]))
    expect(document.activeElement).toBe(container.querySelector('h1'))
    const status = () => container.querySelector('.ledger-announce')?.textContent
    expect(status()).toBe('Planning the search')
    render(ledgerOf([plan('Sudan')]))
    expect(status()).toBe('Gathering sources')
    render(ledgerOf([plan('Sudan'), { type: 'ranked', merged: 9, deduped: 9, kept: 4, outlets: 3 }]))
    expect(status()).toBe('Writing the briefing')
  })
})

