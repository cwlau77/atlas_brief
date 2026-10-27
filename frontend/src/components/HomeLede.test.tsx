import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HomeLede } from './HomeLede'

describe('HomeLede', () => {
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
  const render = () => act(() => root.render(<HomeLede />))
  const text = () => (container.textContent ?? '').replace(/\s+/g, ' ').trim()

  it('is one sentence: what Atlas tells you, without the source counts', () => {
    render()
    expect(text()).toBe('Know what changed, where it happened, and who disagrees.')
    expect(container.querySelector('p.home-lede em')?.textContent).toBe('what changed, where it happened, and who disagrees')
  })
})
