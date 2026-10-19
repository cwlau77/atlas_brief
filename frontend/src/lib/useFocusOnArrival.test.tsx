import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, type InitialEntry } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFocusOnArrival } from './useFocusOnArrival'

function Page() {
  useFocusOnArrival('home-ask')
  return <input id="home-ask" />
}

describe('useFocusOnArrival', () => {
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
  const mount = (entry: InitialEntry) => act(() => root.render(<MemoryRouter initialEntries={[entry]}><Page /></MemoryRouter>))

  it('focuses the ask input when the link asked for it', () => {
    mount({ pathname: '/', state: { focusAsk: true } })
    expect(document.activeElement?.id).toBe('home-ask')
  })

  it('leaves focus alone on a plain visit', () => {
    mount('/')
    expect(document.activeElement?.id).not.toBe('home-ask')
  })
})
