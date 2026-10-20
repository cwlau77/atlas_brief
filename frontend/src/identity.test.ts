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

describe('geometry', () => {
  const css = Object.entries(files).filter(([f]) => f.endsWith('.css'))
  it('squares the radius tokens and drops the lift shadow', () => {
    expect(tokens).toMatch(/--radius: 0;/)
    expect(tokens).toMatch(/--radius-sm: 0;/)
    expect(tokens).not.toContain('--shadow-lift')
  })
  it('uses no lift shadow anywhere', () => {
    expect(css.filter(([, src]) => src.includes('var(--shadow-lift)')).map(([f]) => f)).toEqual([])
  })
  it('keeps corners square except dots and pills', () => {
    const allowed = /^(0|50%|999px|var\(--radius[\w-]*\))$/
    const offenders = css.flatMap(([f, src]) =>
      [...src.matchAll(/border-radius:\s*([^;}!]+)/g)]
        .map((m) => m[1].trim())
        .filter((v) => !allowed.test(v))
        .map((v) => `${f}: ${v}`),
    )
    expect(offenders).toEqual([])
  })
})
