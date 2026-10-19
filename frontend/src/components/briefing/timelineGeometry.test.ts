import { describe, expect, it } from 'vitest'
import css from './story.css?raw'

const rule = (selector: string) => css.match(new RegExp(`(^|\\n)${selector.replace('.', '\\.')} \\{([^}]*)\\}`))?.[2] ?? ''

describe('timeline geometry', () => {
  // The spine is absolutely positioned over the node column; it must be derived from the
  // same column sizes as the grid, or it drifts off the dots when a size changes.
  it('positions the spine from the grid column variables, not literals', () => {
    const grid = rule('.timeline')
    const spine = rule('.spine')
    expect(grid).toContain('grid-template-columns: var(--t-time) var(--t-node)')
    expect(grid).toContain('column-gap: var(--t-gap)')
    expect(spine).toMatch(/left: calc\(var\(--t-time\) \+ var\(--t-gap\) \+ var\(--t-node\) \/ 2 - 1px\)/)
  })
})
