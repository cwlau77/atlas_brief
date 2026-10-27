import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ViewAlert } from '../../lib/normalize'
import { AlertCallout } from './AlertCallout'

const alert = (i: number, extra: Partial<ViewAlert> = {}): ViewAlert => ({
  type: 'urgent', label: 'Critical', title: `Alert ${i}`, description: `Why ${i}`, sources: [], commonsImage: null, ...extra,
})

describe('AlertCallout (Read first)', () => {
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

  it('renders nothing when there are no alerts', () => {
    act(() => root.render(<AlertCallout alerts={[]} />))
    expect(container.innerHTML).toBe('')
  })

  it('read first shows 3 and reveals more', () => {
    act(() => root.render(<AlertCallout alerts={[1, 2, 3, 4, 5].map((i) => alert(i))} />))
    const titles = () => [...container.querySelectorAll('.alert:not(.is-overflow) .alert-title')].map((t) => t.textContent)
    expect(titles()).toEqual(['Alert 1', 'Alert 2', 'Alert 3'])
    // Print shows every alert: the extras stay in the DOM, hidden on screen by a class.
    const extras = [...container.querySelectorAll('.alert.is-overflow .alert-title')].map((t) => t.textContent)
    expect(extras).toEqual(['Alert 4', 'Alert 5'])
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Show 2 more')!
    expect(more.classList.contains('text-btn')).toBe(true)
    act(() => more.click())
    expect(titles()).toEqual(['Alert 1', 'Alert 2', 'Alert 3', 'Alert 4', 'Alert 5'])
    expect(container.querySelector('.is-overflow')).toBeNull()
    expect(container.textContent).not.toContain('Show 2 more')
  })

  it('has no reveal control with 3 or fewer alerts', () => {
    act(() => root.render(<AlertCallout alerts={[1, 2, 3].map((i) => alert(i))} />))
    expect(container.querySelectorAll('.alert')).toHaveLength(3)
    expect(container.querySelector('.alerts-show')).toBeNull()
  })

  it('puts a Commons file photo with its credit on top of the cell', () => {
    const commonsImage = { url: 'https://upload.wikimedia.org/a.jpg', page_url: 'https://commons.wikimedia.org/wiki/File:A.jpg', author: 'Jane Doe', license: 'CC BY-SA 4.0', source: 'commons' as const }
    act(() => root.render(<AlertCallout alerts={[alert(1, { commonsImage })]} />))
    const cell = container.querySelector('.alert')!
    expect(cell.firstElementChild!.classList.contains('card-img-top')).toBe(true)
    expect(cell.querySelector('.card-img-label')!.textContent).toBe('File photo')
    expect(cell.querySelector('figcaption')!.textContent).toBe('File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons')
  })

  it('prefers a source photo over Commons and clamps the rationale', () => {
    const sources = [{ outlet: 'Reuters', url: 'https://r.eu/1', published_at: null, image_url: 'https://img.r.eu/1.jpg' }]
    act(() => root.render(<AlertCallout alerts={[alert(1, { sources })]} />))
    expect(container.querySelector('.card-img-top img')!.getAttribute('src')).toBe('https://img.r.eu/1.jpg')
    expect(container.querySelector('.alert-body')!.classList.contains('clamp-2')).toBe(true)
  })

  it('a clamped summary opens with More and closes with Less', () => {
    act(() => root.render(<AlertCallout alerts={[alert(1, { description: 'A long rationale that runs past two lines.' })]} />))
    const body = container.querySelector<HTMLElement>('.alert-body')!
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent === 'More')!
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-controls')).toBe(body.id)
    expect(more.getAttribute('aria-label')).toBe('More: Alert 1')
    act(() => more.click())
    expect(body.classList.contains('open')).toBe(true)
    const less = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Less')!
    expect(less.getAttribute('aria-expanded')).toBe('true')
    act(() => less.click())
    expect(body.classList.contains('open')).toBe(false)
  })
})
