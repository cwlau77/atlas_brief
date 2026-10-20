import { describe, expect, it } from 'vitest'
import html from '../index.html?raw'
import tokens from './styles/tokens.css?raw'
import base from './styles/base.css?raw'
import footerCss from './components/footer.css?raw'
import footerTsx from './components/Footer.tsx?raw'
import storyCss from './components/briefing/story.css?raw'

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

describe('footer', () => {
  const rule = (sel: string) => {
    const m = footerCss.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'm'))
    return m ? m[1] : ''
  }
  it('lockup keeps its glyph bottoms: line-height >= 0.9 and no negative bottom margin', () => {
    const lockup = rule('.footer-lockup')
    expect(lockup).not.toBe('')
    expect(parseFloat(lockup.match(/line-height:\s*([\d.]+)/)![1])).toBeGreaterThanOrEqual(0.9)
    expect(lockup).not.toMatch(/margin-bottom:\s*-/)
  })
  it('mountain band is paper, not celadon or ink', () => {
    expect(rule('.mountain-band')).not.toMatch(/background:\s*var\(--(celadon|ink)/)
  })
  it('paints the mountains in grayscale', () => {
    expect(/grayscale\(1\)/.test(rule('.mountain-band img')) || footerTsx.includes('mountains-wash')).toBe(true)
  })
})

describe('focus and print', () => {
  it('suppresses the ring on programmatically focused headings only', () => {
    expect(base).toMatch(/\[tabindex="-1"\]:focus\s*\{\s*outline:\s*none;?\s*\}/)
    expect(base).toContain(':focus-visible')
  })
  it('keeps the retired .cur selector out of print rules', () => {
    expect(base).not.toMatch(/\.cur\b/)
  })
})

describe('development cards', () => {
  const rule = (css: string, sel: string) => {
    const m = css.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'm'))
    return m ? m[1] : ''
  }
  it('pins the .dev grid to one shrinkable track so long tab titles ellipsize', () => {
    expect(rule(storyCss, '.dev')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })
  it('lets tab buttons shrink and long chips wrap', () => {
    expect(rule(storyCss, '.dev-links')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(rule(storyCss, '.dev-tab')).toMatch(/min-width:\s*0/)
    expect(rule(storyCss, '.source-chip')).toMatch(/overflow-wrap:\s*anywhere/)
    expect(rule(storyCss, '.tags li')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})
