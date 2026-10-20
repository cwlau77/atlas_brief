import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ATLAS_MARK_PALETTES, AtlasMark } from './AtlasMark'

describe('AtlasMark', () => {
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

  const fill = (part: string) => container.querySelector(`[data-part="${part}"]`)?.getAttribute('fill')

  it('draws three ultramarine folds and a red fix', () => {
    act(() => root.render(<AtlasMark />))
    expect(fill('left')).toBe('#AEBBF5')
    expect(fill('centre')).toBe('#5A73EA')
    expect(fill('right')).toBe('#1F3FE0')
    expect(fill('fix')).toBe('#E2381B')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the reversed palette on dark grounds', () => {
    act(() => root.render(<AtlasMark reversed />))
    expect(fill('left')).toBe(ATLAS_MARK_PALETTES.reversed.left)
    expect(fill('left')).toBe('#D5DCFA')
    expect(fill('centre')).toBe('#8FA2F3')
    expect(fill('right')).toBe('#5A73EA')
    expect(fill('fix')).toBe('#FF6A4D')
  })

  it('is announced as an image when given a title', () => {
    act(() => root.render(<AtlasMark title="Atlas" />))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Atlas')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })
})
