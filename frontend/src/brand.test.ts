import { describe, expect, it } from 'vitest'
// ?raw imports are typed by vite/client, so this needs no Node types in the app tsconfig.
import html from '../index.html?raw'

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
