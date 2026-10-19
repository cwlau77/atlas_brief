import { describe, expect, it } from 'vitest'
import confirmCss from './confirm.css?raw'
import cursorCss from './cursor.css?raw'

describe('confirm dialog styles', () => {
  // base.css resets every margin to 0, which removes the browser's `margin: auto` that centres a modal dialog.
  it('centres the dialog despite the global margin reset', () => {
    const rule = confirmCss.match(/(^|\n)\.confirm \{([^}]*)\}/)?.[2] ?? ''
    expect(rule).toContain('margin: auto')
  })

  // A modal dialog sits in the top layer, above the custom cursor's z-index, so the custom
  // cursor would be hidden behind it while `.has-cursor` hides the native one.
  it('gives back the native cursor, and hides the custom one, while a dialog is open', () => {
    expect(cursorCss).toMatch(/html:has\(dialog\[open\]\)\.has-cursor,\s*html:has\(dialog\[open\]\)\.has-cursor \* \{ cursor: auto !important; \}/)
    expect(cursorCss).toMatch(/html:has\(dialog\[open\]\) \.cur \{ opacity: 0; \}/)
    expect(cursorCss).toMatch(/html:has\(dialog\[open\]\)\.has-cursor dialog button \{ cursor: pointer !important; \}/)
  })
})
