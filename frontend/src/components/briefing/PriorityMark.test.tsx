import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { PriorityMark } from './PriorityMark'

describe('PriorityMark', () => {
  it('normalises legacy all-caps alert labels', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(<PriorityMark priority="high" label="CRITICAL" />))
    expect(container.textContent).toBe('Critical')
    act(() => root.unmount())
  })
})
