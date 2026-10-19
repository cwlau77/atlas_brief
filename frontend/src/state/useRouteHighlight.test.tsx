import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useRouteHighlight, type RouteHighlight } from './useRouteHighlight'

describe('useRouteHighlight', () => {
  let container: HTMLDivElement
  let root: Root
  let h: RouteHighlight
  function Probe() {
    h = useRouteHighlight()
    return null
  }
  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
    act(() => root.render(<Probe />))
  })
  afterEach(() => act(() => root.unmount()))

  it('lights opened keys plus the hovered one', () => {
    expect([...h.lit]).toEqual([])
    act(() => h.toggle('tension-0'))
    act(() => h.setHovered('contradiction-1'))
    expect(h.openKeys.has('tension-0')).toBe(true)
    expect(h.hovered).toBe('contradiction-1')
    expect([...h.lit].sort()).toEqual(['contradiction-1', 'tension-0'])
    act(() => h.toggle('tension-0'))
    act(() => h.setHovered(null))
    expect([...h.lit]).toEqual([])
  })
})
