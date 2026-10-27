import { describe, expect, it } from 'vitest'
import homeCss from './home.css?raw'

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// Every top-level rule as [selector list, declarations]; rules nested in @media blocks match too (they follow a newline), while the at-rule lines themselves are skipped.
function rules(css: string): [string, string][] {
  const out: [string, string][] = []
  for (const m of strip(css).matchAll(/(^|\n)([^{}@\n][^{}]*)\{([^}]*)\}/g)) out.push([m[2].trim(), m[3]])
  return out
}
// Declarations of every top-level rule whose selector list includes `selector` exactly.
const rulesFor = (css: string, selector: string) =>
  rules(css).filter(([sel]) => sel.split(',').map((s) => s.trim()).includes(selector)).map(([, d]) => d)

// The css with every `@media (prefers-reduced-motion: no-preference) {…}` block removed, braces balanced.
function withoutMotionBlocks(css: string): string {
  const marker = '@media (prefers-reduced-motion: no-preference)'
  let out = strip(css)
  for (let start = out.indexOf(marker); start >= 0; start = out.indexOf(marker)) {
    const open = out.indexOf('{', start)
    let depth = 0
    let end = open
    for (; end < out.length; end++) {
      if (out[end] === '{') depth++
      else if (out[end] === '}' && --depth === 0) break
    }
    out = out.slice(0, start) + out.slice(end + 1)
  }
  return out
}

describe('home styles', () => {
  it('has no global chip rules left on Home', () => {
    for (const [selector] of rules(homeCss)) {
      expect(selector, selector).not.toMatch(/(^|[\s,])\.chips?\b/)
    }
  })

  it('masks the contour rings behind the wire, like the ask box', () => {
    expect(rulesFor(homeCss, '.wire').join(';')).toMatch(/background:\s*var\(--paper\)/)
  })

  it('drops the time column when the wire shows suggestions', () => {
    const wide = rulesFor(homeCss, '.wire-suggested .wire-line').join(';')
    expect(wide).toMatch(/grid-template-columns:\s*1fr auto/)
    const narrow = homeCss.slice(homeCss.indexOf('@media (max-width: 480px)'))
    expect(rulesFor(narrow, '.wire-suggested .wire-line').join(';')).toMatch(/grid-template-columns:\s*1fr\s*;/)
  })

  it('gives wire lines a target at least 24px high', () => {
    const decls = rulesFor(homeCss, '.wire-line').join(';')
    const px = Number(decls.match(/min-height:\s*(\d+(?:\.\d+)?)px/)?.[1])
    expect(px).toBeGreaterThanOrEqual(24)
  })

  it('uses the shared focus ring on wire lines', () => {
    const ring = rulesFor(homeCss, '.wire-line:focus-visible').join(';')
    expect(ring).toContain('outline: 2px solid var(--accent)')
    expect(ring).toContain('outline-offset: 2px')
  })

  it('only animates the wire under reduced-motion: no-preference', () => {
    expect(homeCss).toContain('@media (prefers-reduced-motion: no-preference)')
    for (const [selector, decls] of rules(withoutMotionBlocks(homeCss))) {
      if (selector.includes('.wire')) expect(decls, selector).not.toMatch(/animation|transition/)
    }
  })

  it('keeps the wire square-cornered', () => {
    for (const [selector, decls] of rules(homeCss)) {
      if (selector.includes('.wire')) expect(decls, selector).not.toContain('border-radius')
    }
  })
})
