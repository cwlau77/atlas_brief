import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { useIndexHighlight } from './useIndexHighlight'

function setup() {
  const ref: { current: ReturnType<typeof useIndexHighlight> } = { current: null as never }
  function Probe() { ref.current = useIndexHighlight(); return null }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Probe)))
  return ref
}

describe('useIndexHighlight', () => {
  it('active is the preview over the pin; pin toggles; clear resets the pin', () => {
    const h = setup()
    expect(h.current.active).toBeNull()
    act(() => h.current.pin('tension-0'))
    expect(h.current.active).toBe('tension-0')
    act(() => h.current.preview('tension-1'))
    expect(h.current.active).toBe('tension-1')
    act(() => h.current.preview(null))
    expect(h.current.active).toBe('tension-0')
    act(() => h.current.pin('tension-0'))
    expect(h.current.pinned).toBeNull()
    act(() => h.current.pin('tension-2'))
    act(() => h.current.clear())
    expect(h.current.pinned).toBeNull()
    expect(h.current.active).toBeNull()
  })
})
