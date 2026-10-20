import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import tokens from './styles/tokens.css?raw'
import base from './styles/base.css?raw'

const files = import.meta.glob(['./**/*.{ts,tsx,css}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('cursor removal', () => {
  it('leaves no cursor lens reference in source', () => {
    const offenders = Object.entries(files).filter(([, src]) => /data-cursor|CursorLens|cursorBus/.test(src)).map(([f]) => f)
    expect(offenders).toEqual([])
  })
})

describe('type', () => {
  it('requests IBM Plex Sans only', () => {
    expect(html).toContain('family=IBM+Plex+Sans')
    for (const gone of ['Jost', 'Hanken', 'IBM+Plex+Mono']) expect(html).not.toContain(gone)
  })
  it('defines Plex as the sans stack and no mono token', () => {
    expect(tokens).not.toContain('--font-mono')
    expect(tokens).toContain("--font-sans: 'IBM Plex Sans'")
  })
  it('has no uppercase, small-caps or mono styling in CSS', () => {
    const offenders = Object.entries(files)
      .filter(([f, src]) => f.endsWith('.css') && /text-transform:\s*uppercase|small-caps|var\(--font-mono\)/.test(src))
      .map(([f]) => f)
    expect(offenders).toEqual([])
  })
  it('has a global accent focus ring', () => {
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline: 2px solid var\(--accent\)/)
  })
})
