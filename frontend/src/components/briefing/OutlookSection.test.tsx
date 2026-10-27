import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutlookRow } from '../../lib/outlook'
import { OutlookSection } from './OutlookSection'

const linked = [{ dev: 2, title: 'Houthi strike hits tanker', timestamp: '2026-10-26T09:00:00Z' }]
const reported = (over: Partial<OutlookRow> = {}): OutlookRow => ({
  key: 'trend-0', kind: 'trend', basis: 'reported', statement: 'Strikes are moving north.', quote: 'the third strike in six days',
  source: { outlet: 'Reuters', url: 'https://r.eu/9', published_at: '2026-10-26T09:00:00Z' }, watchFor: null, devs: [2], linked, ...over,
})
const assessment = (over: Partial<OutlookRow> = {}): OutlookRow => ({
  key: 'implication-0', kind: 'implication', basis: 'assessment', statement: 'Escort rules will widen.', quote: null,
  source: null, watchFor: 'An EU Council decision', devs: [2], linked, ...over,
})

describe('OutlookSection', () => {
  let container: HTMLDivElement
  let root: Root
  const preview = vi.fn()
  const open = vi.fn()
  const render = (trends: OutlookRow[], implications: OutlookRow[]) =>
    act(() => root.render(<OutlookSection trends={trends} implications={implications} timeZone="UTC" preview={preview} onOpen={open} />))
  beforeEach(() => {
    preview.mockReset(); open.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })
  const items = () => [...container.querySelectorAll<HTMLLIElement>('li.outlook-item')]

  it('renders the heading, the legend and a heading per non-empty list', () => {
    render([reported()], [])
    expect(container.querySelector('section#outlook h2')!.textContent).toBe('Trends & implications')
    const legend = container.querySelector('.outlook-legend')!.textContent
    expect(legend).toContain('Reported: an outlet says it, quoted and linked')
    expect(legend).toContain("Atlas assessment: Atlas's own reading, not reported fact")
    expect([...container.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Trends'])
  })

  it('shows the quote and a link to the article on a Reported row', () => {
    render([reported()], [assessment()])
    const [r] = items()
    expect(r.className).toBe('outlook-item reported')
    expect(r.textContent).toContain('Reported')
    expect(r.querySelector('q')!.textContent).toBe('the third strike in six days')
    const a = r.querySelector('a')!
    expect(a.getAttribute('href')).toBe('https://r.eu/9')
    expect(a.textContent).toBe('Reuters · 26 Oct')
    expect(a.getAttribute('aria-label')).toBe('Read in Reuters: Strikes are moving north.')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toContain('noopener')
    expect(r.textContent).toContain('Builds on')
  })

  it('shows the outlet alone when the source has no date', () => {
    render([reported({ source: { outlet: 'Reuters', url: 'https://r.eu/9', published_at: null } })], [])
    expect(items()[0].querySelector('a')!.textContent).toBe('Reuters')
  })

  it('labels an assessment, with no quote or link, and reasons from its developments', () => {
    render([], [assessment()])
    const [r] = items()
    expect(r.className).toBe('outlook-item assessment')
    expect(r.textContent).toContain('Atlas assessment')
    expect(r.querySelector('q')).toBeNull()
    expect(r.querySelector('a')).toBeNull()
    expect(r.textContent).toContain('Reasoned from')
    expect(r.textContent).toContain('Watch forAn EU Council decision')
  })

  it('shows Watch for only when set', () => {
    render([reported()], [])
    expect(items()[0].textContent).not.toContain('Watch for')
  })

  it('jumps to a development from the list', () => {
    render([reported()], [])
    act(() => items()[0].querySelector<HTMLButtonElement>('.index-ties button')!.click())
    expect(open).toHaveBeenCalledWith('dev-2')
    expect(preview).toHaveBeenLastCalledWith(null)
  })

  it('previews its developments on hover and focus', () => {
    render([reported()], [])
    const li = items()[0]
    act(() => { li.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(preview).toHaveBeenLastCalledWith('trend-0')
    act(() => { li.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
    expect(preview).toHaveBeenLastCalledWith(null)
    act(() => li.querySelector<HTMLButtonElement>('.index-ties button')!.focus())
    expect(preview).toHaveBeenLastCalledWith('trend-0')
    act(() => li.querySelector<HTMLButtonElement>('.index-ties button')!.blur())
    expect(preview).toHaveBeenLastCalledWith(null)
  })

  it('renders nothing when both lists are empty', () => {
    render([], [])
    expect(container.innerHTML).toBe('')
  })
})
