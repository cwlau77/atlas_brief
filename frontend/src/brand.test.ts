import { describe, expect, it } from 'vitest'
// ?raw imports are typed by vite/client, so this needs no Node types in the app tsconfig.
import html from '../index.html?raw'
import fav from '../public/brand/favicon.svg?raw'
import lockup from '../public/brand/atlas-lockup.svg?raw'
import lockupRev from '../public/brand/atlas-lockup-reversed.svg?raw'
import markRev from '../public/brand/atlas-mark-reversed.svg?raw'
import mark from '../public/brand/atlas-mark.svg?raw'

const lockups = { lockup, lockupRev, markRev }
const ORIGIN = 'https://atlasbrief-nine.vercel.app'

describe('index.html brand metadata', () => {
  it('names the product Atlas', () => {
    expect(html).toContain('<title>Atlas</title>')
    expect(html).not.toContain('Atlas Brief')
  })
  it('uses absolute URLs for share previews', () => {
    expect(html).toContain(`<meta property="og:image" content="${ORIGIN}/brand/og-card.png" />`)
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/" />`)
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })
})

describe('favicon', () => {
  it('is linked from index.html', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />')
  })
  it('switches to the reversed palette on dark tab strips', () => {
    expect(fav).toContain('@media (prefers-color-scheme: dark)')
    const dark = fav.slice(fav.indexOf('@media (prefers-color-scheme: dark)'))
    for (const c of ['#D5DCFA', '#8FA2F3', '#5A73EA', '#FF6A4D']) expect(dark).toContain(c)
  })
})

describe('brand mark', () => {
  it('is drawn in ultramarine with a red fix', () => {
    for (const c of ['#AEBBF5', '#5A73EA', '#1F3FE0', '#E2381B']) expect(mark).toContain(c)
  })
  it('leaves no celadon or old blue in any brand svg', () => {
    for (const svg of [mark, fav, ...Object.values(lockups)]) {
      expect(svg).not.toContain('B4CCBE')
      expect(svg).not.toContain('3358C7')
    }
  })
})
