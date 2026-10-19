import { describe, expect, it } from 'vitest'

const files = import.meta.glob(['./**/*.{ts,tsx,css}', '!./**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const MOSS = /3D5A45|6F8A6F|2A3F31|61,\s?90,\s?69|9AAA92|C9D2C0|--moss/i

describe('celadon palette', () => {
  it('leaves no moss colour or token in source', () => {
    const offenders = Object.entries(files).filter(([, src]) => MOSS.test(src)).map(([f]) => f)
    expect(offenders).toEqual([])
  })
  it('defines the celadon tokens and spacing scale', () => {
    const tokens = files['./styles/tokens.css']
    for (const t of ['--celadon-light: #B4CCBE', '--celadon: #5E8A79', '--celadon-deep: #3A5F52', '--space-1: 4px', '--space-9: 96px']) expect(tokens).toContain(t)
  })
})
