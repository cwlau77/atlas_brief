import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ICONS } from './icons'

const NAMES = [
  'StarIcon', 'ExternalIcon', 'TrashIcon', 'PrintIcon', 'ExpandIcon', 'TensionIcon', 'DisagreeIcon',
  'AlertCriticalIcon', 'AlertHighIcon', 'AlertElevatedIcon', 'ProfileIcon', 'TimeIcon', 'ReadingIcon', 'DataIcon',
  'ExportIcon', 'ClearIcon',
]

describe('icon set', () => {
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

  it('exports exactly the sixteen icons', () => {
    expect(Object.keys(ICONS).sort()).toEqual([...NAMES].sort())
  })

  it.each(NAMES)('%s is a faceted, decorative 24-grid svg in currentColor', (name) => {
    const Icon = ICONS[name]
    act(() => root.render(<Icon size={20} />))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    const shapes = [...svg.querySelectorAll('path, polygon, circle, rect')]
    expect(shapes.length).toBeGreaterThanOrEqual(2)
    for (const s of shapes) expect(['currentColor', 'none']).toContain(s.getAttribute('fill'))
  })
})
