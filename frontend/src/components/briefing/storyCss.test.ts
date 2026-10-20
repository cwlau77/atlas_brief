import { describe, expect, it } from 'vitest'
import storyCss from './story.css?raw'

// The body of the first `@media (max-width: 980px)` block that holds `selector`.
function mediaRule(css: string, selector: string): string {
  const blocks = css.split('@media (max-width: 980px)').slice(1)
  for (const b of blocks) {
    const at = b.indexOf(selector + ' {')
    if (at >= 0) return b.slice(at, b.indexOf('}', at))
  }
  return ''
}
const rule = (css: string, selector: string) =>
  css.match(new RegExp(`(^|\\n)${selector.replace(/[.>]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`))?.[2] ?? ''

describe('story styles', () => {
  // The globe carousel is absolutely positioned; its wrapper must stay a containing block on every width.
  it('keeps the globe wrapper positioned below 980px', () => {
    const small = mediaRule(storyCss, '.kd-globe > .kd-globe-sticky')
    expect(small).toContain('position: relative')
    expect(small).not.toContain('position: static')
    // Two classes: outranks cards.css `.story-globe` whatever order the sheets load in.
    expect(rule(storyCss, '.kd-globe > .kd-globe-sticky')).toContain('position: sticky')
  })

  it('shares Read first hairlines without widening the cells', () => {
    const cell = rule(storyCss, '.alert')
    expect(cell).not.toMatch(/margin:[^;]*-1px/)
    expect(rule(storyCss, '.alert-list')).toContain('gap: 1px')
  })

  it('gives the Read first reveal a 44px target and a focus ring', () => {
    expect(rule(storyCss, '.alerts-show')).toContain('min-height: 44px')
    expect(rule(storyCss, '.alerts-show:focus-visible')).toContain('outline: 2px solid var(--accent)')
  })
})
