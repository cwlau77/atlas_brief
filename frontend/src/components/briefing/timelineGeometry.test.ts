import { describe, expect, it } from 'vitest'
import css from './story.css?raw'

const rule = (selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`))?.[2] ?? ''

describe('timeline geometry', () => {
  // The spine is absolutely positioned over the node column; it must be derived from the
  // same column sizes as the grid, or it drifts off the dots when a size changes.
  it('positions the spine from the grid column variables, not literals', () => {
    const grid = rule('.timeline')
    const spine = rule('.spine')
    expect(grid).toContain('grid-template-columns: var(--t-node) minmax(0, 1fr)')
    expect(spine).toContain('left: calc(var(--t-node) / 2 - 1px)')
  })
  it('reserves no lane column', () => {
    expect(rule('.timeline')).not.toContain('--t-lanes')
  })
})
