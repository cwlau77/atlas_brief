import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEYS } from '../lib/storage'
import { AppStateProvider } from '../state/AppState'
import { makeBriefing } from '../test/fixtures'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    localStorage.setItem(KEYS.saved, JSON.stringify([makeBriefing({ id: 'a', area: 'A' }), makeBriefing({ id: 'b', area: 'B' })]))
    localStorage.setItem(KEYS.starred, JSON.stringify(['a']))
    localStorage.setItem(KEYS.profile, JSON.stringify({ firstName: 'Cam', lastName: 'Lau', emailAddress: '', fieldOfStudy: 'International Relations' }))
    localStorage.setItem(KEYS.settings, JSON.stringify({ compactMode: true }))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><AppStateProvider><SettingsPage /></AppStateProvider></MemoryRouter>))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    localStorage.clear()
  })
  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!

  it('has a section index linking each section', () => {
    const index = [...container.querySelectorAll('.settings-index a')].map((a) => [a.textContent, a.getAttribute('href')])
    expect(index).toEqual([['Profile', '#profile'], ['Time', '#time'], ['Reading', '#reading'], ['Your data', '#data']])
    for (const id of ['profile', 'time', 'reading', 'data']) expect(container.querySelector(`#${id}`)).not.toBeNull()
  })

  it('shows a profile header and reveals the form on Edit profile', () => {
    expect(container.querySelector('.profile-avatar')!.textContent).toBe('CL')
    expect(container.textContent).toContain('International Relations')
    expect(container.querySelectorAll('.profile-fields input')).toHaveLength(0)
    act(() => button('Edit profile').click())
    expect(container.querySelectorAll('.profile-fields input')).toHaveLength(4)
  })

  it('summarises stored data', () => {
    expect(container.querySelector('#data')!.textContent).toContain('2 briefings · 1 starred')
  })

  it('clears the archive only after confirming, keeping settings', () => {
    act(() => button('Clear archive').click())
    const dialog = container.querySelector('dialog')!
    expect(dialog.hasAttribute('open')).toBe(true)
    act(() => [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Cancel')!.click())
    expect(container.querySelector('#data')!.textContent).toContain('2 briefings')

    act(() => button('Clear archive').click())
    act(() => [...dialog.querySelectorAll('button')].find((b) => b.textContent === 'Clear archive')!.click())
    expect(container.querySelector('#data')!.textContent).toContain('0 briefings · 0 starred')
    expect(JSON.parse(localStorage.getItem(KEYS.settings)!).compactMode).toBe(true)
  })
})
