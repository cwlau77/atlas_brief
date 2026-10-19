import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEYS } from '../lib/storage'
import { AppStateProvider } from '../state/AppState'
import { makeBriefing } from '../test/fixtures'
import { ArchivePage } from './ArchivePage'

const day = (d: number) => new Date(Date.UTC(2026, 9, d, 12)).toISOString()

describe('ArchivePage threads', () => {
  let container: HTMLDivElement
  let root: Root
  const mount = (url = '/archive') => act(() => root.render(
    <MemoryRouter initialEntries={[url]}><AppStateProvider><ArchivePage /></AppStateProvider></MemoryRouter>,
  ))
  beforeEach(() => {
    localStorage.setItem(KEYS.saved, JSON.stringify([
      makeBriefing({ id: 'r2', area: 'red sea  shipping', generatedAt: day(17) }),
      makeBriefing({ id: 'c1', area: 'Chip export controls', generatedAt: day(16), alerts: [] }),
      makeBriefing({ id: 'r1', area: 'Red Sea shipping', generatedAt: day(12) }),
    ]))
    localStorage.setItem(KEYS.starred, JSON.stringify(['c1']))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    localStorage.clear()
  })
  const rows = () => [...container.querySelectorAll('.thread-row')]
  const beads = (row: Element) => [...row.querySelectorAll<HTMLAnchorElement>('a.bead')]

  it('strings same-topic briefings onto one thread', () => {
    mount()
    expect(rows()).toHaveLength(2)
    const red = rows()[0]
    expect(beads(red).map((a) => a.getAttribute('href'))).toEqual(['/brief/r1', '/brief/r2'])
    expect(beads(red)[1].getAttribute('aria-label')).toMatch(/red sea {2}shipping, 17 Oct, 214 articles, high alert/i)
  })

  it('reads the Starred filter from the URL', () => {
    mount('/archive?filter=starred')
    expect(rows()).toHaveLength(1)
    expect(beads(rows()[0]).map((a) => a.getAttribute('href'))).toEqual(['/brief/c1'])
  })

  it('states the storage policy', () => {
    mount()
    expect(container.textContent).toContain('Up to 4 briefings per topic and 24 in total are kept in this browser.')
  })

  it('compares two briefings picked from the beads', () => {
    mount()
    const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Compare two')!
    act(() => toggle.click())
    const picks = [...container.querySelectorAll<HTMLButtonElement>('button.bead')]
    expect(picks).toHaveLength(3)
    act(() => picks[0].click())
    act(() => picks[1].click())
    expect(picks[0].getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Side by side')
  })

  it('shows the empty state with no briefings', () => {
    localStorage.clear()
    mount()
    expect(container.textContent).toContain('No threads yet')
    expect([...container.querySelectorAll('a')].some((a) => a.textContent === 'Start a brief')).toBe(true)
  })

  it('offers every briefing action without hover, for touch screens', () => {
    mount()
    const manage = rows()[0].querySelector('details.thread-manage')!
    const items = [...manage.querySelectorAll('li')]
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('a')!.getAttribute('href')).toBe('/brief/r1')
    const names = [...items[0].querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
    expect(names.some((n) => n?.startsWith('Star'))).toBe(true)
    expect(names.some((n) => n?.startsWith('Delete'))).toBe(true)
  })

  describe('select mode', () => {
    const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === name || b.getAttribute('aria-label') === name)
    const box = (name: RegExp) => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((c) => name.test(c.getAttribute('aria-label') ?? ''))!
    const redAll = /^Select all in red sea\s+shipping$/i
    const boxes = () => [...container.querySelectorAll<HTMLInputElement>('.thread-string input[type="checkbox"]')]
    const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]
    const enter = () => { mount(); act(() => button('Select')!.click()) }

    it('puts a named checkbox on every briefing and a select-all on every thread', () => {
      enter()
      expect(button('Select')!.getAttribute('aria-pressed')).toBe('true')
      expect(boxes()).toHaveLength(3)
      expect(boxes()[0].getAttribute('aria-label')).toMatch(/^Select Red Sea shipping, 12 Oct/)
      expect(box(redAll)).toBeDefined()
      expect(container.querySelector('a.bead')).toBeNull()
    })

    it('selects a whole thread, showing partial selection on its select-all', () => {
      enter()
      const all = box(redAll)
      act(() => boxes()[0].click())
      expect(all.indeterminate).toBe(true)
      act(() => all.click())
      expect(boxes().slice(0, 2).every((c) => c.checked)).toBe(true)
      expect(all.checked).toBe(true)
      expect(container.querySelector('.select-bar')?.textContent).toContain('2 selected')
      act(() => all.click())
      expect(boxes().some((c) => c.checked)).toBe(false)
    })

    it('stars, then unstars, everything selected', () => {
      enter()
      act(() => box(redAll).click())
      act(() => button('Star 2')!.click())
      expect(stored(KEYS.starred).sort()).toEqual(['c1', 'r1', 'r2'])
      act(() => button('Unstar 2')!.click())
      expect(stored(KEYS.starred)).toEqual(['c1'])
    })

    it('deletes the selection after a confirmation that counts starred briefings', () => {
      enter()
      act(() => boxes()[2].click()) // c1, starred
      act(() => boxes()[0].click()) // r1
      act(() => button('Delete 2')!.click())
      const dialog = container.querySelector('dialog')!
      expect(dialog.textContent).toContain('Remove 2 briefings?')
      expect(dialog.textContent).toContain('1 of them is starred')
      act(() => [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!.click())
      expect((stored(KEYS.saved) as { id: string }[]).map((b) => b.id)).toEqual(['r2'])
      expect(stored(KEYS.starred)).toEqual([])
      expect(container.querySelector('.select-bar')).toBeNull()
    })

    it('clears the selection when leaving select mode, and turns Compare off', () => {
      enter()
      act(() => boxes()[0].click())
      act(() => button('Compare two')!.click())
      expect(button('Select')!.getAttribute('aria-pressed')).toBe('false')
      expect(boxes()).toHaveLength(0)
      act(() => button('Select')!.click())
      expect(button('Compare two')!.getAttribute('aria-pressed')).toBe('false')
      expect(boxes().some((c) => c.checked)).toBe(false)
    })
  })
})
