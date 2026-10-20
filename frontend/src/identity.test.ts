import { describe, expect, it } from 'vitest'

const files = import.meta.glob(['./**/*.{ts,tsx,css}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('cursor removal', () => {
  it('leaves no cursor lens reference in source', () => {
    const offenders = Object.entries(files).filter(([, src]) => /data-cursor|CursorLens|cursorBus/.test(src)).map(([f]) => f)
    expect(offenders).toEqual([])
  })
})
