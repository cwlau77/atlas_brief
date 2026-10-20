import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBriefing } from '../../test/fixtures'
import { DevelopmentCard } from './DevelopmentCard'

const briefing = makeBriefing()
const COMMONS = { url: 'https://upload.wikimedia.org/a.jpg', page_url: 'https://commons.wikimedia.org/wiki/File:A.jpg', author: 'Jane Doe', license: 'CC BY-SA 4.0', source: 'commons' as const }

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
      dev={briefing.keyDevelopments[0]} index={0} showContext timeZone="UTC"
      connection="1 tension · 1 contradiction" indexId="tension-index" onTag={() => {}}
      {...over}
    />,
  ))
  const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  const article = () => container.querySelector('article.dev')!

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

  it('hides background entirely when historical context is turned off', () => {
    render({ showContext: false })
    expect(button('Read background')).toBeUndefined()
    expect(container.querySelector('.dev-context')).toBeNull()
  })

  it('shows its time in the card', () => {
    render()
    expect(container.querySelector('.dev-top time')!.textContent).toBe('02:10 UTC')
  })

  it('connection tag calls onTag', () => {
    const onTag = vi.fn()
    render({ onTag })
    const tag = container.querySelector<HTMLButtonElement>('.dev-conn')!
    expect(tag.textContent).toBe('1 tension · 1 contradiction')
    act(() => tag.click())
    expect(onTag).toHaveBeenCalledTimes(1)
  })

  it('renders no tag when nothing connects', () => {
    render({ connection: null })
    expect(container.querySelector('.dev-conn')).toBeNull()
  })

  it('takes the outlet image first and lays out beside it', () => {
    render()
    expect(article().firstElementChild!.classList.contains('card-img')).toBe(true)
    expect(container.querySelector('.card-img img')!.getAttribute('src')).toBe('https://img.r.eu/1.jpg')
  })

  it('falls back to the Commons photo, then to no image', () => {
    const plain = briefing.keyDevelopments[1]
    render({ dev: { ...plain, commonsImage: COMMONS } })
    expect(container.querySelector('.card-img img')!.getAttribute('src')).toBe(COMMONS.url)
    render({ dev: plain })
    expect(container.querySelector('.card-img')).toBeNull()
  })

  it('applies the highlight state', () => {
    render({ highlight: 'lit' })
    expect(article().classList.contains('is-lit')).toBe(true)
    render({ highlight: 'dim' })
    expect(article().classList.contains('is-dim')).toBe(true)
    expect(article().classList.contains('is-lit')).toBe(false)
  })

  it('reports hover and focus', () => {
    const onHover = vi.fn()
    const onFocusChange = vi.fn()
    render({ onHover, onFocusChange })
    act(() => { article().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })) })
    expect(onHover).toHaveBeenLastCalledWith(true)
    act(() => { article().dispatchEvent(new MouseEvent('mouseout', { bubbles: true })) })
    expect(onHover).toHaveBeenLastCalledWith(false)
    act(() => button('Read background')!.focus())
    expect(onFocusChange).toHaveBeenLastCalledWith(true)
    act(() => button('Read background')!.blur())
    expect(onFocusChange).toHaveBeenLastCalledWith(false)
  })

  it('mouse-click focus does not pin the globe; keyboard focus does', () => {
    const onFocusChange = vi.fn()
    render({ onFocusChange })
    const toggle = button('Read background')!
    // A click: pointerdown lands first, then focus.
    act(() => {
      toggle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      toggle.focus()
    })
    expect(onFocusChange).not.toHaveBeenCalledWith(true)
    act(() => toggle.blur())
    // Tabbing in: focus with no pointer press.
    act(() => toggle.focus())
    expect(onFocusChange).toHaveBeenLastCalledWith(true)
    act(() => toggle.blur())
    // Focus moved onto the card itself (scrollToStory) counts even after a click elsewhere.
    const card = article() as HTMLElement
    card.setAttribute('tabindex', '-1')
    act(() => {
      toggle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      card.focus()
    })
    expect(onFocusChange).toHaveBeenLastCalledWith(true)
  })
})
