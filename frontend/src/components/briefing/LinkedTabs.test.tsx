import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ROUTE_COLORS } from '../../lib/routes'
import type { LinkRef } from '../../lib/timeline'
import { makeBriefing } from '../../test/fixtures'
import { LinkedTabs } from './LinkedTabs'

const LINKS: LinkRef[] = [{ kind: 'tension', i: 0, key: 'tension-0' }, { kind: 'contradiction', i: 0, key: 'contradiction-0' }]

describe('LinkedTabs route colours', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  it('gives a tab its route colour dot only when its link is a route, and outlines lit tabs', () => {
    act(() => root.render(
      <LinkedTabs
        devIndex={0} links={LINKS} briefing={makeBriefing()}
        colorFor={new Map([['tension-0', ROUTE_COLORS[0]]])} lit={new Set(['tension-0'])}
        openKeys={new Set()} onToggleLink={() => {}} onHoverLink={() => {}}
      />,
    ))
    const [tensionTab, contraTab] = [...container.querySelectorAll<HTMLButtonElement>('.dev-tab')]
    const dot = tensionTab.querySelector<HTMLElement>('.route-dot')
    expect(dot?.style.getPropertyValue('--route')).toBe('var(--route-1)')
    expect(contraTab.querySelector('.route-dot')).toBeNull()
    expect(tensionTab.classList.contains('lit')).toBe(true)
    expect(contraTab.classList.contains('lit')).toBe(false)
  })
})
