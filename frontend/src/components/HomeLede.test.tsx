import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SourcesInfo } from '../lib/sources'
import { HomeLede } from './HomeLede'

const svc = (name: string, enabled: boolean, financeOnly = false) => ({ name, label: name, enabled, financeOnly })
const info = (live: number): SourcesInfo => ({
  services: [
    ...Array.from({ length: live }, (_, i) => svc(`live${i}`, true)),
    svc('off', false),
    svc('finnhub', true, true),
  ],
  feeds: { count: 26, outlets: [] },
})

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
  const render = (i: SourcesInfo | null) => act(() => root.render(<HomeLede info={i} />))
  const text = () => (container.textContent ?? '').replace(/\s+/g, ' ').trim()

  it('states the live counts, spelling out numbers under ten', () => {
    render(info(8))
    expect(text()).toBe(
      'Know what changed, where it happened, and who disagrees. Atlas reads across eight news services and 26 newsroom feeds and writes a cited briefing for analysts, writers and anyone who follows world events seriously.',
    )
    expect(container.querySelector('p.home-lede em')?.textContent).toBe('what changed, where it happened, and who disagrees')
  })

  it('prints no number before the sources are known', () => {
    render(null)
    expect(text()).toContain('Atlas reads across a range of news services and newsroom feeds and writes a cited briefing for')
    expect(text()).not.toMatch(/\d/)
  })

  it('follows the live service count', () => {
    render(info(3))
    expect(text()).toContain('three news services')
  })
})
