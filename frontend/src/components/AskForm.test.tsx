import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AskForm } from './AskForm'

describe('AskForm prefill', () => {
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

  const render = (prefill?: { text: string; n: number }, loading = false) =>
    act(() => root.render(
      <AskForm id="t" loading={loading} error={null} onGenerate={vi.fn()} onRetry={vi.fn()} prefill={prefill} />,
    ))
  const input = () => container.querySelector('input') as HTMLInputElement

  it('fills the input with the prefill text, even while loading', () => {
    render()
    expect(input().value).toBe('')
    render({ text: 'Red Sea shipping', n: 1 }, true)
    expect(input().value).toBe('Red Sea shipping')
  })

  it('refills when the same topic is picked again', () => {
    render({ text: 'Gaza', n: 1 })
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input(), 'edited')
      input().dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(input().value).toBe('edited')
    render({ text: 'Gaza', n: 2 })
    expect(input().value).toBe('Gaza')
  })

  it('leaves loading progress to the ledger: no timed status line', () => {
    render(undefined, true)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Briefing…')
  })
})
