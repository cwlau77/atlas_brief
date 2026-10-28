import { describe, expect, it } from 'vitest'
import css from './hotspots.css?raw'

const declarations = (selector: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(^|\n)([^{}@\n][^{}]*)\{([^}]*)\}/g)]
    .filter((m) => m[2].split(',').map((s) => s.trim()).includes(selector))
    .map((m) => m[3])
    .join('')

describe('hotspots.css', () => {
  it('clips the stage sideways only, so the closed panel hides but tooltips and arcs can rise above it', () => {
    const stage = declarations('.hs-stage')
    expect(stage).toMatch(/overflow-x:\s*clip/)
    expect(stage).toMatch(/overflow-y:\s*visible/)
    expect(stage).not.toMatch(/overflow:\s*hidden/)
    // The closed panel moves along x only, which overflow-x: clip hides.
    expect(declarations('.hs-panel.is-collapsible')).toMatch(/transform:\s*translateX\(100%\)/)
  })
})
