import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedBriefing } from '../../lib/normalize'
import type { RouteHighlight } from '../../state/useRouteHighlight'
import { makeBriefing } from '../../test/fixtures'
import { Timeline } from './Timeline'

const highlight = (): RouteHighlight => ({ openKeys: new Set(), toggle: () => {}, hovered: null, setHovered: () => {}, lit: new Set() })

describe('Timeline routes', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  const render = (briefing: SavedBriefing) => act(() => root.render(
    <Timeline briefing={briefing} timeZone="UTC" showContext reduced highlight={highlight()} />,
  ))

  it('renders no key and no route lines when nothing links two developments', () => {
    render(makeBriefing())
    expect(container.querySelector('.route-key')).toBeNull()
    expect(container.querySelector('.routes path, .routes line')).toBeNull()
    expect(container.querySelector('.threads')).toBeNull()
  })

  it('renders the key above the timeline when a route exists', () => {
    const b = makeBriefing()
    b.emergingTensions[0] = { ...b.emergingTensions[0], description: 'Red Sea escorts strained.' }
    render(b)
    const key = container.querySelector('.route-key')
    expect(key).not.toBeNull()
    expect(key!.compareDocumentPosition(container.querySelector('.timeline')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll('.dev-tab .route-dot')).toHaveLength(2)
  })
})
