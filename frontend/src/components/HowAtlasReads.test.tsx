import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STATIC_SERVICE_LABELS, type SourcesInfo } from '../lib/sources'
import { HowAtlasReads } from './HowAtlasReads'

const svc = (name: string, label: string, enabled: boolean, financeOnly = false) => ({ name, label, enabled, financeOnly })
const INFO: SourcesInfo = {
  services: [
    svc('newsapi', 'NewsAPI', true), svc('gdelt', 'GDELT 2.0', true), svc('google_news', 'Google News', true),
    svc('guardian', 'The Guardian', true), svc('gnews', 'GNews', true), svc('newsdata', 'NewsData.io', true),
    svc('brave', 'Brave Search', false), svc('tavily', 'Tavily', true), svc('exa', 'Exa', true),
    svc('finnhub', 'Finnhub', true, true), svc('marketaux', 'Marketaux', false, true), svc('alphavantage', 'Alpha Vantage', false, true),
  ],
  feeds: { count: 26, outlets: ['BBC', 'Al Jazeera', 'DW', 'France 24', 'The Hindu', 'AllAfrica', 'Straits Times', 'Axios', 'Politico'] },
}

describe('HowAtlasReads', () => {
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
  const render = (info: SourcesInfo | null) => act(() => root.render(<HowAtlasReads info={info} />))
  const entry = (label: string) => [...container.querySelectorAll('li')].find((li) => li.textContent?.startsWith(label))

  describe('with info', () => {
    beforeEach(() => render(INFO))

    it('is the how-atlas-reads section with a live-number title', () => {
      const section = container.querySelector('section#how-atlas-reads')
      expect(section).not.toBeNull()
      expect(section?.querySelector('h2')?.textContent).toBe('Eight news services, 26 newsroom feeds, one briefing.')
    })

    it('makes three points', () => {
      const heads = [...container.querySelectorAll('h3')].map((h) => h.textContent)
      expect(heads).toEqual(['Breadth', 'Corroboration', 'Disagreement'])
    })

    it('marks disabled services "off" and leaves enabled ones plain', () => {
      expect(entry('NewsAPI')?.textContent).not.toContain('off')
      expect(entry('Brave Search')?.textContent).toContain('off')
    })

    it('lists finance services only after "Finance questions add"', () => {
      const text = container.textContent ?? ''
      const marker = text.indexOf('Finance questions add')
      expect(marker).toBeGreaterThan(-1)
      expect(text.indexOf('Finnhub')).toBeGreaterThan(marker)
      expect(text.indexOf('Alpha Vantage')).toBeGreaterThan(marker)
      expect(text.indexOf('Exa')).toBeLessThan(marker)
    })

    it('names outlets on the feeds line', () => {
      const feeds = container.querySelector('.har-feeds')?.textContent ?? ''
      expect(feeds).toContain('26 newsroom feeds: ')
      expect(feeds).toContain('BBC')
      expect(feeds).toContain('Al Jazeera')
      expect(feeds.endsWith(', …')).toBe(true)
      expect(feeds).not.toContain('Politico')
    })
  })

  describe('with info null', () => {
    beforeEach(() => render(null))

    it('uses the numberless title', () => {
      expect(container.querySelector('h2')?.textContent).toBe('News services and newsroom feeds, one briefing.')
    })

    it('lists every static label with no off marker', () => {
      for (const label of STATIC_SERVICE_LABELS) expect(entry(label)).toBeDefined()
      expect(container.textContent).not.toContain('off')
    })
  })
})
