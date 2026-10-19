import { describe, expect, it } from 'vitest'
// ?raw imports are typed by vite/client, so this needs no Node types in the app tsconfig.
import html from '../index.html?raw'
import fav from '../public/brand/favicon.svg?raw'
import mark from '../public/brand/atlas-mark.svg?raw'

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
    expect(fav).toContain('#F3EEE3')
    expect(fav).toContain('#D3E2D9')
    expect(fav).toContain('#8FA9F2')
  })
})

describe('brand mark', () => {
  it('is drawn in celadon, not moss', () => {
    expect(mark).toContain('#5E8A79')
    expect(mark).not.toContain('#3D5A45')
  })
})
