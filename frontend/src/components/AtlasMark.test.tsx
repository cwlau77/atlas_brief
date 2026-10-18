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

  it('draws three green folds and a terracotta fix', () => {
    act(() => root.render(<AtlasMark />))
    expect(fill('left')).toBe('#6F8A6F')
    expect(fill('centre')).toBe('#3D5A45')
    expect(fill('right')).toBe('#2A3F31')
    expect(fill('fix')).toBe('#B5532E')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the reversed palette on dark grounds', () => {
    act(() => root.render(<AtlasMark reversed />))
    expect(fill('left')).toBe(ATLAS_MARK_PALETTES.reversed.left)
    expect(fill('fix')).toBe('#E07A52')
  })

  it('is announced as an image when given a title', () => {
    act(() => root.render(<AtlasMark title="Atlas" />))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Atlas')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })
})
