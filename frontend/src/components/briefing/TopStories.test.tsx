import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ViewDevelopment } from '../../lib/normalize'
import { topStories } from '../../lib/topStories'
import { makeBriefing } from '../../test/fixtures'
import { TopStories } from './TopStories'

const dev = (priority: ViewDevelopment['priority'], timestamp: string): ViewDevelopment => ({
  title: `${priority} ${timestamp}`, content: '', historicalContext: '', priority, regions: [], sources: [],
  timestamp, leadImage: null, place: null, commonsImage: null,
})

describe('topStories', () => {
  it('ranks high > medium > low, then newest first, capped at 5', () => {
    const devs = [
      dev('low', '2026-10-16T09:00:00Z'),
      dev('medium', '2026-10-16T01:00:00Z'),
      dev('high', '2026-10-16T02:00:00Z'),
      dev('medium', '2026-10-16T05:00:00Z'),
      dev('low', '2026-10-16T10:00:00Z'),
      dev('low', '2026-10-16T08:00:00Z'),
    ]
    expect(topStories(devs)).toEqual([2, 3, 1, 4, 0])
    expect(topStories(devs, 2)).toEqual([2, 3])
  })
  it('hides the strip with fewer than two developments', () => {
    expect(topStories([dev('high', '2026-10-16T02:00:00Z')])).toEqual([])
    expect(topStories([])).toEqual([])
  })
})

describe('TopStories', () => {
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

  it('renders a labelled strip with one card per top story, in rank order', () => {
    const briefing = makeBriefing()
    act(() => root.render(<TopStories briefing={briefing} timeZone="UTC" onOpen={() => {}} />))
    const section = container.querySelector('section')!
    const heading = section.querySelector(`#${section.getAttribute('aria-labelledby')}`)
    expect(heading?.textContent).toBe('Top stories')
    const titles = [...section.querySelectorAll('.story-card-open')].map((b) => b.textContent)
    const expected = topStories(briefing.keyDevelopments).map((i) => briefing.keyDevelopments[i].title)
    expect(titles).toEqual(expected)
    expect(titles).toHaveLength(3)
  })

  it('renders nothing for a single development', () => {
    const briefing = makeBriefing()
    act(() => root.render(
      <TopStories briefing={{ ...briefing, keyDevelopments: briefing.keyDevelopments.slice(0, 1) }} timeZone="UTC" onOpen={() => {}} />,
    ))
    expect(container.innerHTML).toBe('')
  })

  it('stacks up to four compact cards beside the globe when used in the lead', () => {
    const base = makeBriefing()
    const keyDevelopments = Array.from({ length: 6 }, (_, i) => ({ ...base.keyDevelopments[i % 3], title: `Story ${i}` }))
    act(() => root.render(<TopStories briefing={{ keyDevelopments }} timeZone="UTC" onOpen={() => {}} layout="stack" />))
    const section = container.querySelector('section')!
    expect(section.classList.contains('top-stories-stack')).toBe(true)
    expect(section.classList.contains('wrap')).toBe(false)
    expect(section.querySelectorAll('.story-card')).toHaveLength(4)
    expect(section.querySelectorAll('.story-card-compact')).toHaveLength(4)
  })
})
