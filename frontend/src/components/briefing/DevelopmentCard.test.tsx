import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinkRef } from '../../lib/timeline'
import { makeBriefing } from '../../test/fixtures'
import { DevelopmentCard } from './DevelopmentCard'

const briefing = makeBriefing()
const LINKS: LinkRef[] = [{ kind: 'tension', i: 0, key: 'tension-0' }, { kind: 'contradiction', i: 0, key: 'contradiction-0' }]

describe('DevelopmentCard', () => {
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

  const render = (over: Partial<Parameters<typeof DevelopmentCard>[0]> = {}) => act(() => root.render(
    <DevelopmentCard
      dev={briefing.keyDevelopments[0]} index={0} showContext briefing={briefing}
      links={LINKS} openKeys={new Set()} onToggleLink={() => {}} onHoverLink={() => {}}
      {...over}
    />,
  ))
  const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))

  it('folds the background behind Read background', () => {
    render()
    const toggle = button('Read background')!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.dev-context-full')).toBeNull()
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent).toContain('Show less')
    expect(container.querySelector('.dev-context-full')!.textContent).toContain('First confirmed hit since June.')
  })

  it('shows a tab per linked item that asks the timeline to toggle it', () => {
    const onToggleLink = vi.fn()
    render({ onToggleLink })
    const tension = button('Tension · High')!
    expect(button('Sources disagree · 2 accounts')).toBeDefined()
    expect(tension.getAttribute('aria-expanded')).toBe('false')
    act(() => tension.click())
    expect(onToggleLink).toHaveBeenCalledWith('tension-0')
  })

  it('expands an open disagreement in place with both accounts', () => {
    render({ openKeys: new Set(['contradiction-0']) })
    expect(button('Sources disagree')!.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('Account A')
    expect(container.textContent).toContain('Hull breach.')
  })

  it('renders no fold or tab row when there is nothing to show', () => {
    render({ dev: { ...briefing.keyDevelopments[0], historicalContext: '' }, links: [] })
    expect(button('Read background')).toBeUndefined()
    expect(container.querySelector('.dev-links')).toBeNull()
  })

  it('hides background entirely when historical context is turned off', () => {
    render({ showContext: false })
    expect(button('Read background')).toBeUndefined()
    expect(container.querySelector('.dev-context')).toBeNull()
  })
})
