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

// The body of the `@media print` block, braces balanced.
function printBlock(css: string): string {
  const start = css.indexOf('@media print {')
  if (start < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i)
  }
  return ''
}
// Declarations of every top-level rule whose selector list includes `selector` exactly.
function rulesFor(css: string, selector: string): string[] {
  const out: string[] = []
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\n)([^{}@\n][^{}]*)\{([^}]*)\}/g)) {
    if (m[2].split(',').map((s) => s.trim()).includes(selector)) out.push(m[3])
  }
  return out
}

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

  it('gives text buttons a 24px target, the shared focus ring and no underline', () => {
    const decls = rulesFor(storyCss, '.text-btn').join(';')
    expect(decls).toContain('min-height: 24px')
    expect(decls).not.toContain('text-decoration: underline')
    const ring = rulesFor(storyCss, '.text-btn:focus-visible').join(';')
    expect(ring).toContain('outline: 2px solid var(--accent)')
    expect(ring).toContain('outline-offset: 2px')
  })

  it('pins with an ink edge on paper-deep and rings the whole row', () => {
    const pinned = rulesFor(storyCss, '.index-item.is-pinned').join(';')
    expect(pinned).toContain('inset 3px 0 0 var(--ink)')
    expect(pinned).toContain('var(--paper-deep)')
    const ring = rulesFor(storyCss, '.index-item:has(.index-row:focus-visible)').join(';')
    expect(ring).toContain('outline: 2px solid var(--accent)')
  })

  it('only hides the row button ring where :has() can ring the row instead', () => {
    const at = storyCss.indexOf('@supports selector(:has(*)) {')
    expect(at).toBeGreaterThan(-1)
    const block = storyCss.slice(at, storyCss.indexOf('\n}', at))
    expect(block).toContain('.index-item:has(.index-row:focus-visible)')
    expect(block).toContain('.index-row:focus-visible { outline: none; }')
    // Nowhere outside the guard.
    expect(storyCss.replace(block, '')).not.toContain('.index-row:focus-visible { outline: none; }')
  })

  it('insets Show N more to line up with the row text', () => {
    expect(rulesFor(storyCss, '.index-show').join(';')).toContain('margin-left: 12px')
    expect(rulesFor(storyCss, '.alerts-show').join(';')).not.toContain('margin-left')
  })

  it('animates the timeline node only without reduced motion', () => {
    expect(rulesFor(storyCss, '.t-node span')[0]).not.toContain('transition')
    const motion = storyCss.slice(storyCss.indexOf('@media (prefers-reduced-motion: no-preference)'))
    expect(storyCss).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^@]*\.t-node span \{[^}]*transition: background-color 0\.4s, box-shadow 0\.4s/)
    expect(motion).toContain('.t-node span')
  })

  it('lets the chip time follow the chip colour on hover', () => {
    expect(rulesFor(storyCss, '.chip:hover .source-chip-time').join(';')).toContain('color: inherit')
  })

  it('makes text buttons hug their label in grid parents', () => {
    expect(rulesFor(storyCss, '.text-btn').join(';')).toContain('justify-self: start')
  })

  it('keeps chip hover on the quick timing, not the card timing', () => {
    const motion = storyCss.slice(storyCss.indexOf('@media (prefers-reduced-motion: no-preference)'))
    expect(motion).not.toMatch(/\.dev \.chip/)
    expect(rulesFor(storyCss, '.chip').join(';')).toContain('border-color var(--dur-quick)')
  })

  it('motions text buttons only without reduced-motion', () => {
    const motion = storyCss.slice(storyCss.indexOf('@media (prefers-reduced-motion: no-preference)'))
    expect(motion).toContain('.text-btn')
    expect(motion).toContain('250ms')
    const outside = storyCss.replace(/@media \(prefers-reduced-motion: no-preference\) \{([^{}]*\{[^}]*\})*\s*\}/g, '')
    expect(rulesFor(outside, '.text-btn').join(';')).not.toContain('transition')
  })

  it('styles chips as hairline boxes with 24px targets', () => {
    const decls = rulesFor(storyCss, '.chip').join(';')
    expect(decls).toContain('border: 1px solid var(--rule)')
    expect(decls).toContain('min-height: 24px')
    expect(decls).not.toContain('background: var(--paper-deep)')
  })

  it('makes From the archive an ink rule with a two-line teaser', () => {
    expect(rulesFor(storyCss, '.dev-context').join(';')).toContain('border-left: 2px solid var(--ink)')
    expect(rulesFor(storyCss, '.dev-context-teaser').join(';')).toContain('line-clamp: 2')
  })

  // WCAG AA: a dimmed card keeps its text legible; only the picture, mark, chips and rule recede.
  it('never fades a dimmed card as a whole', () => {
    const decls = rulesFor(storyCss, '.dev.is-dim').join(';')
    for (const m of decls.matchAll(/opacity:\s*([\d.]+)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(1)
    expect(rulesFor(storyCss, '.dev.is-dim .card-img img').join(';')).toMatch(/opacity|grayscale/)
  })

  it('prints every alert and index row, unclamped, without the reveal controls', () => {
    const print = printBlock(storyCss)
    for (const sel of ['.alert.is-overflow', '.index-item.is-overflow']) {
      // Hidden on screen; the print rule, same selector and later, shows it again.
      const screen = storyCss.slice(0, storyCss.indexOf('@media print {'))
      expect(rulesFor(screen, sel).join(';'), sel).toContain('display: none')
      expect(rulesFor(print, sel).join(';'), sel).toMatch(/display:\s*grid/)
    }
    for (const sel of ['.clamp-2', '.index-why', '.dev-context-teaser']) {
      const decls = rulesFor(print, sel).join(';')
      expect(decls, sel).toContain('-webkit-line-clamp: unset')
      expect(decls, sel).toContain('overflow: visible')
    }
    for (const sel of ['.text-btn', '.dev-conn']) {
      expect(rulesFor(print, sel).join(';'), sel).toMatch(/display:\s*none/)
    }
    expect(rulesFor(print, '.dev-context-teaser').join(';')).toContain('-webkit-line-clamp: unset')
  })

  it('gives the reason toggle and region tags 24px targets', () => {
    expect(rulesFor(storyCss, '.text-btn').join(';')).toMatch(/min-height:\s*(2[4-9]|[3-9]\d)px/)
    expect(rulesFor(storyCss, '.chip').join(';')).toMatch(/min-height:\s*(2[4-9]|[3-9]\d)px/)
  })
})
