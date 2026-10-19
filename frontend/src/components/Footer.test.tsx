import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Footer } from './Footer'

describe('Footer', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><Footer /></MemoryRouter>))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })
  const link = (text: string) => [...container.querySelectorAll('a')].find((a) => a.textContent === text)

  it('has Read, You and Project columns', () => {
    expect([...container.querySelectorAll('.footer-col h2')].map((h) => h.textContent)).toEqual(['Read', 'You', 'Project'])
  })

  it('links to the right places', () => {
    expect(link('New brief')!.getAttribute('href')).toBe('/')
    expect(link('Archive')!.getAttribute('href')).toBe('/archive')
    expect(link('Starred')!.getAttribute('href')).toBe('/archive?filter=starred')
    expect(link('Settings')!.getAttribute('href')).toBe('/settings')
    expect(link('Time zone')!.getAttribute('href')).toBe('/settings#time')
    const gh = link('GitHub')!
    expect(gh.getAttribute('href')).toBe('https://github.com/cwlau77/atlas_brief')
    expect(gh.getAttribute('target')).toBe('_blank')
    expect(gh.getAttribute('rel')).toContain('noopener')
  })

  it('carries the lockup home link, the model note and a decorative painting', () => {
    const home = container.querySelector('a[aria-label="Atlas home"]')!
    expect(home.querySelector('svg [data-part="fix"]')).not.toBeNull()
    expect(container.textContent).toContain('Analysis is model-written. Check it against the cited sources.')
    expect(container.querySelector('.mountain-band img')!.getAttribute('alt')).toBe('')
  })
})
