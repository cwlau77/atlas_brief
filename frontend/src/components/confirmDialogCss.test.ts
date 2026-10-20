import { describe, expect, it } from 'vitest'
import confirmCss from './confirm.css?raw'

describe('confirm dialog styles', () => {
  // base.css resets every margin to 0, which removes the browser's `margin: auto` that centres a modal dialog.
  it('centres the dialog despite the global margin reset', () => {
    const rule = confirmCss.match(/(^|\n)\.confirm \{([^}]*)\}/)?.[2] ?? ''
    expect(rule).toContain('margin: auto')
  })
})
