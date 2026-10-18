# Atlas Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the frontend from "Atlas Brief" to Atlas with the G5 folded-map mark, the Jost lockup, tightened colour roles, the new type system, and Higgsfield-made brand imagery.

**Architecture:** Design tokens and global CSS change first (type and colour), then a single `AtlasMark` React component carries the logo into the nav. Static brand files (SVGs, PNG favicons, share card) are generated once by small scripts and committed under `frontend/public/brand/`. Higgsfield generates three images (one 3D logo render, two backdrops), each gated by the user's approval before it is wired in.

**Tech Stack:** React 19 + Vite + TypeScript, vitest (jsdom), plain CSS with custom-property tokens, Python 3 + fontTools (wordmark outlining, one-off), headless Google Chrome (SVG/HTML to PNG), macOS `sips` (image conversion), Higgsfield CLI 1.2.2.

**Spec:** `docs/superpowers/specs/2026-10-18-atlas-brand-identity-design.md`

## Global Constraints

- Product name in all user-facing text is **Atlas**; the verb "brief" stays ("Brief me on…", "Brief me", "New brief").
- Do not rename: Render service, Vercel project, the API `service` field `atlas-brief-api`, localStorage/sessionStorage keys, backend `User-Agent`, or comments that refer to the repository folder name ("Atlas Brief" path with a space in `vite.config.ts` and `frontend/README.md`).
- Mark geometry (100×100 grid): left `M8 84 L36 20 L36 76Z`, centre `M36 20 L64 32 L64 88 L36 76Z`, right `M64 32 L92 84 L64 88Z`, fix `circle cx=36 cy=13 r=5`.
- Mark colours, default: left `#6F8A6F`, centre `#3D5A45`, right `#2A3F31`, fix `#B5532E`. Reversed: left `#F3EEE3`, centre `#C9D2C0`, right `#9AAA92`, fix `#E07A52`.
- Lockup: mark height = 0.92 × font size, gap 0.28em, lowercase "atlas" in Jost 500; text `#3D5A45` on oat, `#F3EEE3` on moss.
- Fonts: Jost 400/500 (display and headings), Hanken Grotesk (body, UI), IBM Plex Mono 400/500 (labels, data). Fraunces is removed entirely.
- Terracotta (`--terra`, `--terra-ink`, `--terra-wash`) is used only for: globe hotspots, high-priority alert marks, the logo fix, focus rings, the active nav/tab indicator, and error states. Everything else that is terracotta today becomes moss.
- Production origin for absolute URLs: `https://atlasbrief-nine.vercel.app`.
- Higgsfield budget: 10 credits total on the free workspace; run `higgsfield generate cost` with the exact params before every `create`; at most 2 attempts for the 3D render and 1 per backdrop; stop and ask the user before any spend beyond that.
- Backdrops are committed as JPEG (spec said WebP; `sips` on this machine reads WebP but cannot write it). Target under 200 KB each.
- Tests: run vitest from the space-free symlink: `ln -sfn "/Users/camlau/Desktop/cs/personal/Atlas Brief" /tmp/atlasbrief && cd /tmp/atlasbrief/frontend && npx vitest run`.

## Review Focus

- **Favicon on a dark browser tab:** the deep-green right fold disappears on a dark tab strip. Expected: `favicon.svg` switches to the reversed palette under `prefers-color-scheme: dark`. Pinned in Task 5 by a check that the file contains the media query and the reversed colours.
- **Jost fails to load or loads late:** the nav must still read "atlas" in a sensible fallback. Expected: the lockup text is live text using `--font-display` with a Futura/Avenir/Helvetica fallback, never an image of text. Pinned in Task 3 by a NavBar test asserting the link text is "atlas" and the mark is an inline SVG.
- **Masthead backdrop image missing or slow:** the masthead text must stay readable. Expected: a solid moss-tinted fallback colour sits under the image, and text contrast does not depend on the image. Pinned in Task 8 by the CSS rule order check (background-color declared alongside the image).
- **Printing a briefing:** a full-bleed backdrop wastes ink and hurts legibility. Expected: the backdrop is dropped in `@media print`. Pinned in Task 8.
- **Share link previews:** crawlers ignore relative `og:image` URLs. Expected: `og:image` and `og:url` are absolute production URLs. Pinned in Task 4 by a test that reads `index.html` and asserts the absolute URL.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `frontend/src/styles/tokens.css` | colour and font tokens | 1 |
| `frontend/index.html` | fonts, title, meta, favicons, Open Graph | 1, 4, 5 |
| `frontend/src/styles/base.css`, `routes/home.css`, `routes/briefing-layout.css`, `components/briefing/story.css`, `components/RotatingHeadline.tsx`, `routes/HomePage.tsx` | heading font, serif removal | 1 |
| CSS files listed in Task 2 | terracotta → moss | 2 |
| `frontend/src/components/AtlasMark.tsx` (new) + test | the logo as a component | 3 |
| `frontend/src/components/NavBar.tsx`, `navbar.css` + `NavBar.test.tsx` (new) | nav lockup | 3 |
| `App.tsx`, `NotFound.tsx`, READMEs, CSS header comments + `frontend/src/brand.test.ts` (new) | rename copy | 4 |
| `frontend/public/brand/*.svg`, `frontend/scripts/brand/outline_wordmark.py` (new) | static logo files | 5 |
| `frontend/scripts/brand/render.sh` (new), `frontend/public/brand/*.png` | PNG favicons | 6 |
| `brandkit/` (repo root, Higgsfield working dir), `frontend/public/brand/atlas-3d.png`, `backdrop-*.jpg` | Higgsfield imagery | 7 |
| `BriefingLayout.tsx`, `briefing-layout.css`, `ArchivePage.tsx`, `NotFound.tsx`, `og-card.html` (new), `og-card.png`, `README.md` | wire imagery | 8 |

---

### Task 1: Type system and tokens

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/index.html:10-16` (font request only)
- Modify: `frontend/src/styles/base.css:1, 40-48, 74-79`
- Modify: `frontend/src/routes/home.css:13-15`
- Modify: `frontend/src/routes/briefing-layout.css:5-20`
- Modify: `frontend/src/components/briefing/story.css:72-82`
- Modify: `frontend/src/components/RotatingHeadline.tsx:22-26`
- Modify: `frontend/src/routes/HomePage.tsx:56`
- Modify: `frontend/src/components/navbar.css:4-5` (temporary: drop serif rule; full lockup in Task 3)

**Interfaces:**
- Produces tokens used by later tasks: `--font-display`, `--moss-light`, `--moss-deep`, `--moss-wash`.

- [ ] **Step 1: Update tokens.** In `tokens.css`, change the header comment to `/* Atlas design tokens: "Oat". Light only. */`. After `--moss: #3D5A45;` add:

```css
  --moss-light: #6F8A6F;
  --moss-deep: #2A3F31;
  --moss-wash: rgba(61, 90, 69, 0.10);
```

Replace the two lines `--font-serif: …;` and `--serif-vars: …;` with:

```css
  --font-display: 'Jost', 'Futura', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif;
```

- [ ] **Step 2: Update the font request** in `index.html` to:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&family=Hanken+Grotesk:wght@300..800&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 3: Headings to Jost.** In `base.css`, change the header comment to `/* Atlas base: reset, type, shared primitives, print. */`. In the `h1, h2, h3, h4` rule set `font-family: var(--font-display);` and `font-weight: 500;` and `letter-spacing: -0.015em;`. Delete the whole `.serif { … }` rule (lines 74-79).

- [ ] **Step 4: Display weights.** In `home.css` `.home-title`, change `font-weight: 600;` to `font-weight: 400;` and add `font-family: var(--font-display);`. In `briefing-layout.css` `.masthead-title`, change `font-weight: 600;` to `font-weight: 500;` and add `font-family: var(--font-display);`.

- [ ] **Step 5: Historical context without serif.** In `story.css` `.dev-context`, delete the `font-family`, `font-style: italic` and `font-variation-settings` lines, and delete `font-style: normal;` from `.dev-context .label` (now redundant).

- [ ] **Step 6: Remove serif class usages.** In `RotatingHeadline.tsx` change the three `className="rot-word serif…"` values to `rot-word`, `rot-word out`, `rot-word in`. In `HomePage.tsx` line 56 change `<em className="serif">` to `<em>`. In `navbar.css` delete the `.wordmark i { … }` line (Task 3 replaces the nav wordmark).

- [ ] **Step 7: Verify no serif references remain.**

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend" && grep -rn -e "font-serif" -e "serif-vars" -e "Fraunces" -e '"serif' -e " serif\b" src index.html | grep -v sans-serif`
Expected: no output.

- [ ] **Step 8: Typecheck, lint, test.**

Run: `cd /tmp/atlasbrief/frontend && npx tsc -b && npx oxlint && npx vitest run`
Expected: tsc and oxlint print nothing; vitest `87 passed`.

- [ ] **Step 9: Commit.**

```bash
git add frontend/src/styles frontend/index.html frontend/src/routes/home.css frontend/src/routes/briefing-layout.css frontend/src/components/briefing/story.css frontend/src/components/RotatingHeadline.tsx frontend/src/routes/HomePage.tsx frontend/src/components/navbar.css
git commit -m "feat(brand): Jost headings, drop Fraunces, add moss shade tokens"
```

---

### Task 2: Colour roles (terracotta becomes signal-only)

**Files (all under `frontend/src/`):** `styles/base.css`, `app.css`, `components/askform.css`, `components/cursor.css`, `components/navbar.css`, `components/CursorLens.tsx`, `components/briefing/story.css`, `routes/archive.css`, `routes/home.css`, `routes/signals.css`, `routes/settings.css`, `routes/briefing-layout.css`, `globe/globe.css`

**Interfaces:**
- Consumes: `--moss`, `--moss-deep`, `--moss-wash` from Task 1.

- [ ] **Step 1: Apply these exact replacements** (left: current, right: new). Keep every terracotta use not listed here (hotspot focus ring, `.prio-high`, `.alert-urgent`, `:focus-visible`, `.tab.active` border, `.toast-error`, `.tz-error`, `.ask-error` wash).

| File | Selector | Change |
|---|---|---|
| `styles/base.css` | `a:hover` | `text-decoration-color: var(--terra)` → `var(--moss)` |
| `styles/base.css` | `.btn-primary` | `background: var(--terra); color: #FBF6EE;` → `background: var(--moss); color: #F3EEE3;` |
| `styles/base.css` | `.btn-primary:hover` | `var(--terra-ink)` → `var(--moss-deep)` |
| `app.css` | `.page-kicker`, `.section-label` | `var(--terra-ink)` → `var(--moss)` |
| `components/askform.css` | `.ask-label` | `var(--terra-ink)` → `var(--moss)` |
| `components/askform.css` | `.ask-beacon` | `background: var(--terra)` → `background: var(--moss)` |
| `components/cursor.css` | `.cur-dot`, `.cur-ring` border, `.cur-ring::before/::after` | `var(--terra)` → `var(--moss)` |
| `components/cursor.css` | `.cur-read` | `var(--terra-ink)` → `var(--moss)` |
| `components/cursor.css` | `[data-cursor-mode="link"] .cur-ring` | `var(--terra-wash)` → `var(--moss-wash)` |
| `components/cursor.css` | `[data-cursor-mode="text"] .cur-ring` | any `var(--terra…)` → `var(--moss)` |
| `components/navbar.css` | `.nav-clock:hover` | `var(--terra-ink)` → `var(--moss)` |
| `components/briefing/story.css` | `.branch-lit` stroke | `var(--terra)` → `var(--moss)` |
| `components/briefing/story.css` | `.link-card.contra` | `var(--terra-wash)` → `var(--moss-wash)` |
| `components/briefing/story.css` | `.link-kind`, `.reading-index` | `var(--terra-ink)` → `var(--moss)` |
| `routes/archive.css` | `.compare-panel > .label`, `.compare-block > .label` | `var(--terra-ink)` → `var(--moss)` |
| `routes/home.css` | `.rot` | `var(--terra-ink)` → `var(--moss)` |
| `routes/signals.css` | `.row:first-child .bar i` | `var(--terra)` → `var(--moss)` |
| `routes/settings.css` | `.settings-card > h2.label` | `var(--terra-ink)` → `var(--moss)` |
| `routes/briefing-layout.css` | `.masthead-kicker` | `var(--terra-ink)` → `var(--moss)` |
| `globe/globe.css` | `.globe-hotspot-label b`, `.globe-panel-head` | keep `var(--terra-ink)` (hotspot UI is a signal role) |

In `CursorLens.tsx` line 8 change the comment to `/** A moss dot and trailing ring that adapts to what's under the pointer. */`.

- [ ] **Step 2: Verify the remaining terracotta uses are only the allowed ones.**

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend/src" && grep -rn "terra" --include='*.css' --include='*.tsx' . | grep -v tokens.css`
Expected: exactly these selectors remain: `.globe-hotspot:focus-visible`, `.globe-hotspot-label b`, `.globe-panel-head`, `:focus-visible` (base.css), `.ask-error` wash (askform.css line ~43), `.toast-error`, `.tz-error`, `.alert-urgent`, `.prio-high svg`, `.tab.active`.

- [ ] **Step 3: Typecheck, lint, test.**

Run: `cd /tmp/atlasbrief/frontend && npx tsc -b && npx oxlint && npx vitest run`
Expected: clean; `87 passed`.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src
git commit -m "feat(brand): moss is primary, terracotta reserved for signals"
```

---

### Task 3: AtlasMark component and nav lockup

**Files:**
- Create: `frontend/src/components/AtlasMark.tsx`
- Create: `frontend/src/components/AtlasMark.test.tsx`
- Create: `frontend/src/components/NavBar.test.tsx`
- Modify: `frontend/src/components/NavBar.tsx:18-22`
- Modify: `frontend/src/components/navbar.css:3-4`

**Interfaces:**
- Produces: `AtlasMark({ reversed?: boolean; title?: string; className?: string }): JSX.Element` and `ATLAS_MARK_PALETTES: { default: Palette; reversed: Palette }` where `Palette = { left: string; centre: string; right: string; fix: string }`. The SVG has `viewBox="0 0 100 100"` and elements tagged `data-part="left|centre|right|fix"`.

- [ ] **Step 1: Write the failing AtlasMark test** at `frontend/src/components/AtlasMark.test.tsx`:

```tsx
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ATLAS_MARK_PALETTES, AtlasMark } from './AtlasMark'

describe('AtlasMark', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const fill = (part: string) => container.querySelector(`[data-part="${part}"]`)?.getAttribute('fill')

  it('draws three green folds and a terracotta fix', () => {
    act(() => root.render(<AtlasMark />))
    expect(fill('left')).toBe('#6F8A6F')
    expect(fill('centre')).toBe('#3D5A45')
    expect(fill('right')).toBe('#2A3F31')
    expect(fill('fix')).toBe('#B5532E')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('uses the reversed palette on dark grounds', () => {
    act(() => root.render(<AtlasMark reversed />))
    expect(fill('left')).toBe(ATLAS_MARK_PALETTES.reversed.left)
    expect(fill('fix')).toBe('#E07A52')
  })

  it('is announced as an image when given a title', () => {
    act(() => root.render(<AtlasMark title="Atlas" />))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Atlas')
    expect(svg.getAttribute('aria-hidden')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/components/AtlasMark.test.tsx`
Expected: FAIL, cannot resolve `./AtlasMark`.

- [ ] **Step 3: Implement** `frontend/src/components/AtlasMark.tsx`:

```tsx
// The Atlas mark: a map folded in three, shaded in moss greens, with a
// terracotta fix at the peak. Geometry and colours are fixed by the brand spec.
type Palette = { left: string; centre: string; right: string; fix: string }

export const ATLAS_MARK_PALETTES: { default: Palette; reversed: Palette } = {
  default: { left: '#6F8A6F', centre: '#3D5A45', right: '#2A3F31', fix: '#B5532E' },
  reversed: { left: '#F3EEE3', centre: '#C9D2C0', right: '#9AAA92', fix: '#E07A52' },
}

export function AtlasMark({ reversed = false, title, className }: {
  reversed?: boolean
  title?: string
  className?: string
}) {
  const p = reversed ? ATLAS_MARK_PALETTES.reversed : ATLAS_MARK_PALETTES.default
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path data-part="left" d="M8 84 L36 20 L36 76Z" fill={p.left} />
      <path data-part="centre" d="M36 20 L64 32 L64 88 L36 76Z" fill={p.centre} />
      <path data-part="right" d="M64 32 L92 84 L64 88Z" fill={p.right} />
      <circle data-part="fix" cx="36" cy="13" r="5" fill={p.fix} />
    </svg>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/components/AtlasMark.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing NavBar test** at `frontend/src/components/NavBar.test.tsx`:

```tsx
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppStateProvider } from '../state/AppState'
import { NavBar } from './NavBar'

describe('NavBar lockup', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<MemoryRouter><AppStateProvider><NavBar /></AppStateProvider></MemoryRouter>))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('links home with the mark and live "atlas" text', () => {
    const home = container.querySelector('a.wordmark')!
    expect(home.getAttribute('aria-label')).toBe('Atlas home')
    expect(home.getAttribute('href')).toBe('/')
    expect(home.querySelector('svg [data-part="fix"]')).not.toBeNull()
    expect(home.textContent).toBe('atlas')
  })
})
```

- [ ] **Step 6: Run it to verify it fails.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/components/NavBar.test.tsx`
Expected: FAIL (aria-label is "Atlas Brief home", text is "AtlasBrief").

- [ ] **Step 7: Implement the lockup.** In `NavBar.tsx` add `import { AtlasMark } from './AtlasMark'` and replace the wordmark link with:

```tsx
        <Link className="wordmark" to="/" aria-label="Atlas home" data-cursor="link">
          <AtlasMark className="wordmark-mark" />
          <span className="wordmark-text">atlas</span>
        </Link>
```

In `navbar.css` replace the `.wordmark { … }` and `.wordmark b { … }` lines with:

```css
.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 0.28em;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.5rem;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--moss);
  text-decoration: none;
}
.wordmark-mark { width: 0.92em; height: 0.92em; flex: none; }
```

- [ ] **Step 8: Run the full suite.**

Run: `cd /tmp/atlasbrief/frontend && npx tsc -b && npx oxlint && npx vitest run`
Expected: clean; `91 passed`.

- [ ] **Step 9: Commit.**

```bash
git add frontend/src/components/AtlasMark.tsx frontend/src/components/AtlasMark.test.tsx frontend/src/components/NavBar.tsx frontend/src/components/NavBar.test.tsx frontend/src/components/navbar.css
git commit -m "feat(brand): AtlasMark component and nav lockup"
```

---

### Task 4: Rename copy and metadata

**Files:**
- Create: `frontend/src/brand.test.ts`
- Modify: `frontend/index.html:5-9`
- Modify: `frontend/src/App.tsx:41`
- Modify: `frontend/src/routes/NotFound.tsx:8`
- Modify: `README.md:1`, `frontend/README.md:1`

**Interfaces:** none (copy and metadata). `index.html` gains Open Graph tags that Task 8 fills with the real card image (the file path is fixed now: `/brand/og-card.png`).

- [ ] **Step 1: Write the failing metadata test** at `frontend/src/brand.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/brand.test.ts`
Expected: FAIL on the title assertion.

- [ ] **Step 3: Update `index.html` head** (lines 5-9) to:

```html
    <link rel="icon" type="image/svg+xml" href="/compass.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Atlas turns global news into a briefing: what changed, where it happened, and what to read next." />
    <meta name="theme-color" content="#EEE8DC" />
    <title>Atlas</title>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Atlas" />
    <meta property="og:title" content="Atlas" />
    <meta property="og:description" content="Brief me on any place or policy: what changed, where it happened, and what to read next." />
    <meta property="og:url" content="https://atlasbrief-nine.vercel.app/" />
    <meta property="og:image" content="https://atlasbrief-nine.vercel.app/brand/og-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
```

(The favicon line is replaced in Task 5.)

- [ ] **Step 4: Update copy.** `App.tsx` line 41: `<span>Atlas · thirteen news sources and 26 newsroom feeds</span>`. `NotFound.tsx` line 8: `That address doesn't match any page in Atlas.` `README.md` line 1: `# Atlas`. `frontend/README.md` line 1: `# Atlas — frontend`.

- [ ] **Step 5: Verify no user-facing "Atlas Brief" remains.**

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && grep -rn "Atlas Brief" frontend/src frontend/index.html README.md frontend/README.md`
Expected: only `frontend/README.md` (path-with-space note) and nothing in `frontend/src` or `index.html`.

- [ ] **Step 6: Run the full suite.**

Run: `cd /tmp/atlasbrief/frontend && npx tsc -b && npx oxlint && npx vitest run`
Expected: clean; `93 passed`.

- [ ] **Step 7: Commit.**

```bash
git add frontend/index.html frontend/src/App.tsx frontend/src/routes/NotFound.tsx frontend/src/brand.test.ts README.md frontend/README.md
git commit -m "feat(brand): rename to Atlas, add Open Graph metadata"
```

---

### Task 5: Static logo files

**Files:**
- Create: `frontend/public/brand/atlas-mark.svg`, `atlas-mark-reversed.svg`, `favicon.svg`
- Create: `frontend/scripts/brand/outline_wordmark.py`
- Create: `frontend/public/brand/atlas-lockup.svg`, `atlas-lockup-reversed.svg` (generated)
- Delete: `frontend/public/compass.svg`, `frontend/public/favicon.svg`
- Modify: `frontend/index.html:5` (favicon links)
- Modify: `frontend/src/brand.test.ts` (favicon checks)

**Interfaces:**
- Produces files at `/brand/atlas-mark.svg` (used by Task 6 as the raster source and Task 7 as the Higgsfield reference) and `/brand/favicon.svg`.

- [ ] **Step 1: Add the failing favicon test** to `frontend/src/brand.test.ts`. Add this import under the existing `html` import:

```ts
import fav from '../public/brand/favicon.svg?raw'
```

and append:

```ts
describe('favicon', () => {
  it('is linked from index.html', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />')
  })
  it('switches to the reversed palette on dark tab strips', () => {
    expect(fav).toContain('@media (prefers-color-scheme: dark)')
    expect(fav).toContain('#F3EEE3')
    expect(fav).toContain('#E07A52')
  })
})
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/brand.test.ts`
Expected: FAIL, the `favicon.svg?raw` import cannot be resolved.

- [ ] **Step 3: Create the mark SVGs.** `frontend/public/brand/atlas-mark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Atlas</title><path d="M8 84 L36 20 L36 76Z" fill="#6F8A6F"/><path d="M36 20 L64 32 L64 88 L36 76Z" fill="#3D5A45"/><path d="M64 32 L92 84 L64 88Z" fill="#2A3F31"/><circle cx="36" cy="13" r="5" fill="#B5532E"/></svg>
```

`frontend/public/brand/atlas-mark-reversed.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Atlas</title><path d="M8 84 L36 20 L36 76Z" fill="#F3EEE3"/><path d="M36 20 L64 32 L64 88 L36 76Z" fill="#C9D2C0"/><path d="M64 32 L92 84 L64 88Z" fill="#9AAA92"/><circle cx="36" cy="13" r="5" fill="#E07A52"/></svg>
```

`frontend/public/brand/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>.l{fill:#6F8A6F}.c{fill:#3D5A45}.r{fill:#2A3F31}.f{fill:#B5532E}@media (prefers-color-scheme: dark){.l{fill:#F3EEE3}.c{fill:#C9D2C0}.r{fill:#9AAA92}.f{fill:#E07A52}}</style><path class="l" d="M8 84 L36 20 L36 76Z"/><path class="c" d="M36 20 L64 32 L64 88 L36 76Z"/><path class="r" d="M64 32 L92 84 L64 88Z"/><circle class="f" cx="36" cy="13" r="5"/></svg>
```

- [ ] **Step 4: Replace the favicon link** in `index.html` (the `compass.svg` line) with:

```html
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
    <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
```

Then delete the old files: `git rm frontend/public/compass.svg frontend/public/favicon.svg`.

- [ ] **Step 5: Run the favicon test and the suite.**

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/brand.test.ts && npx tsc -b && npx vitest run`
Expected: brand tests PASS (4); typecheck clean; suite `95 passed`.

- [ ] **Step 6: Write the wordmark outliner** at `frontend/scripts/brand/outline_wordmark.py`. It downloads Jost, pins the weight to 500, converts "atlas" to SVG paths and writes both lockups, so the files render without the font:

```python
"""Write the Atlas lockup SVGs with "atlas" outlined from Jost 500.

Usage (from the repo root):
  python3 -m venv /tmp/atlas-brand && /tmp/atlas-brand/bin/pip install fonttools
  /tmp/atlas-brand/bin/python frontend/scripts/brand/outline_wordmark.py
"""
import io
import pathlib
import urllib.request

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

JOST_URL = "https://github.com/google/fonts/raw/main/ofl/jost/Jost%5Bwght%5D.ttf"
OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "brand"
MARK = {
    False: ("#6F8A6F", "#3D5A45", "#2A3F31", "#B5532E", "#3D5A45"),
    True: ("#F3EEE3", "#C9D2C0", "#9AAA92", "#E07A52", "#F3EEE3"),
}
FONT_SIZE = 100  # lockup units: mark height 0.92em = 92, gap 0.28em = 28


def word_path(font: TTFont, text: str, size: float, x0: float, baseline: float) -> tuple[str, float]:
    scale = size / font["head"].unitsPerEm
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    pen = SVGPathPen(glyphs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += font["hmtx"][name][0] * scale
    return pen.getCommands(), x


def main() -> None:
    raw = urllib.request.urlopen(JOST_URL).read()
    font = instantiateVariableFont(TTFont(io.BytesIO(raw)), {"wght": 500})
    cap = font["OS/2"].sCapHeight / font["head"].unitsPerEm * FONT_SIZE
    xh = font["OS/2"].sxHeight / font["head"].unitsPerEm * FONT_SIZE
    mark_h = 0.92 * FONT_SIZE
    baseline = mark_h / 2 + xh / 2  # x-height centred on the mark
    d, end = word_path(font, "atlas", FONT_SIZE, mark_h + 0.28 * FONT_SIZE, baseline)
    width = end + 2
    for reversed_, suffix in ((False, ""), (True, "-reversed")):
        l, c, r, f, text = MARK[reversed_]
        k = mark_h / 100
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.1f} {mark_h:.1f}"><title>Atlas</title>'
            f'<g transform="scale({k:.4f})"><path d="M8 84 L36 20 L36 76Z" fill="{l}"/>'
            f'<path d="M36 20 L64 32 L64 88 L36 76Z" fill="{c}"/><path d="M64 32 L92 84 L64 88Z" fill="{r}"/>'
            f'<circle cx="36" cy="13" r="5" fill="{f}"/></g><path d="{d}" fill="{text}"/></svg>'
        )
        (OUT / f"atlas-lockup{suffix}.svg").write_text(svg)
    print(f"wrote lockups ({width:.0f}x{mark_h:.0f}); cap height {cap:.1f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 7: Generate the lockups.**

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && python3 -m venv /tmp/atlas-brand && /tmp/atlas-brand/bin/pip install -q fonttools && /tmp/atlas-brand/bin/python frontend/scripts/brand/outline_wordmark.py`
Expected: `wrote lockups (…x92); cap height …` and two files in `frontend/public/brand/`. Open `atlas-lockup.svg` in a browser (`open -a "Google Chrome" frontend/public/brand/atlas-lockup.svg`) and confirm the mark sits left of a moss "atlas" with its x-height centred on the mark.

- [ ] **Step 8: Commit.**

```bash
git add frontend/public/brand frontend/scripts/brand/outline_wordmark.py frontend/index.html frontend/src/brand.test.ts
git commit -m "feat(brand): mark, lockup and favicon SVGs"
```

---

### Task 6: PNG favicons

**Files:**
- Create: `frontend/scripts/brand/render.sh`
- Create: `frontend/public/brand/favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png` (generated)

**Interfaces:**
- Produces `render.sh <html-or-svg> <out.png> <width> <height> [transparent]`, reused by Task 8 for the share card.

- [ ] **Step 1: Write the renderer** at `frontend/scripts/brand/render.sh`:

```bash
#!/usr/bin/env bash
# Rasterise a local SVG/HTML file with headless Chrome.
# Usage: render.sh <input> <output.png> <width> <height> [transparent]
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
in="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
bg=()
if [[ "${5:-}" == "transparent" ]]; then bg=(--default-background-color=00000000); fi
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  "${bg[@]}" --window-size="$3,$4" --screenshot="$2" "file://$in" >/dev/null 2>&1
sips -g pixelWidth -g pixelHeight "$2" | tail -2
```

Run: `chmod +x frontend/scripts/brand/render.sh`

- [ ] **Step 2: Render the favicons.** The 16 and 32 px icons are the transparent mark; the touch icon is the mark on oat with padding (iOS ignores transparency).

```bash
cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend"
cat > /tmp/atlas-touch.html <<'EOF'
<html><body style="margin:0;background:#EEE8DC;display:grid;place-items:center;width:180px;height:180px"><img src="file:///Users/camlau/Desktop/cs/personal/Atlas%20Brief/frontend/public/brand/atlas-mark.svg" width="128" height="128"></body></html>
EOF
scripts/brand/render.sh public/brand/atlas-mark.svg public/brand/favicon-32.png 32 32 transparent
scripts/brand/render.sh public/brand/atlas-mark.svg public/brand/favicon-16.png 16 16 transparent
scripts/brand/render.sh /tmp/atlas-touch.html public/brand/apple-touch-icon.png 180 180
```

Expected: each command prints `pixelWidth: N` / `pixelHeight: N` matching the requested size.

- [ ] **Step 3: Inspect.** Open the three PNGs (`open public/brand/*.png`) and confirm the folds are distinguishable at 16 px and the touch icon has an oat ground.

- [ ] **Step 4: Commit.**

```bash
git add frontend/scripts/brand/render.sh frontend/public/brand/*.png
git commit -m "feat(brand): PNG favicons and touch icon"
```

---

### Task 7: Higgsfield imagery (gated by user approval)

**Files:**
- Create: `brandkit/prompts.md` (repo root; prompts, job ids, credits spent)
- Create: `frontend/public/brand/atlas-3d.png`, `backdrop-masthead.jpg`, `backdrop-card.jpg`

**Interfaces:**
- Produces the three image files above, consumed by Task 8.

- [ ] **Step 1: Check balance and cost.**

Run: `higgsfield account status && higgsfield generate cost seedream_v5_pro --prompt "test" --aspect_ratio 1:1 --resolution 2k && higgsfield generate cost nano_banana_2 --prompt "test" --aspect_ratio 16:9 --resolution 2k`
Expected: 10 credits available; Seedream about 2.5, Nano Banana 2 about 2. If the balance is below 8, stop and tell the user.

- [ ] **Step 2: Generate the 3D logo render** (attempt 1 of at most 2). Record the prompt and job id in `brandkit/prompts.md`.

```bash
cd "/Users/camlau/Desktop/cs/personal/Atlas Brief"
higgsfield generate create seedream_v5_pro --aspect_ratio 1:1 --resolution 2k \
  --image-references frontend/public/brand/favicon-32.png \
  --prompt "A physical 3D object of this exact logo: a paper map folded into three upright panels in a zigzag, matte uncoated paper with subtle fibre texture, the left panel light sage green #6F8A6F, the middle panel moss green #3D5A45, the right panel deep forest green #2A3F31, a small glossy terracotta enamel bead #B5532E floating just above the peak of the left fold. Soft directional studio light from the left, gentle contact shadow, centred, seen slightly from above at three-quarter angle, on a plain warm oat background #EEE8DC with fine film grain. Minimal, premium product render, no text, no extra objects." \
  --wait --json
```

Download the result URL to `brandkit/atlas-3d-attempt1.png` (`curl -sL "<url>" -o brandkit/atlas-3d-attempt1.png`).

- [ ] **Step 3: User gate.** Show the user the image (Read it into the conversation) and ask: approve, or retry with a specific change (one retry allowed, same command with the prompt adjusted). Do not continue until the user approves one image. If both attempts are rejected, record that and use the fallback in Task 8 (the flat SVG mark in place of the 3D render). Copy the approved file to `frontend/public/brand/atlas-3d.png`.

- [ ] **Step 4: Generate the two backdrops** (one attempt each).

```bash
higgsfield generate create nano_banana_2 --aspect_ratio 21:9 --resolution 2k \
  --prompt "Abstract painterly background, soft grainy film texture, deep moss green #3D5A45 field blending into warm oat #EEE8DC at the top right, a low diffuse terracotta #B5532E glow near the bottom left, slow brushed gradients like light through haze, analog print grain, no objects, no text, no shapes, calm and premium." \
  --wait --json
higgsfield generate create nano_banana_2 --aspect_ratio 16:9 --resolution 2k \
  --prompt "Abstract painterly background, soft grainy film texture, rich moss green #3D5A45 with darker forest green #2A3F31 edges, a soft terracotta #B5532E glow in the lower right corner, faint sage #9AAA92 haze top left, analog print grain, no objects, no text, no shapes, calm and premium." \
  --wait --json
```

Download to `brandkit/backdrop-masthead.png` and `brandkit/backdrop-card.png`.

- [ ] **Step 5: User gate.** Show both images; the user approves or rejects each. A rejected backdrop uses the CSS fallback in Task 8 (no retry without the user's explicit go-ahead and remaining credits).

- [ ] **Step 6: Convert approved backdrops to JPEG.**

```bash
sips -s format jpeg -s formatOptions 70 --resampleWidth 2400 brandkit/backdrop-masthead.png --out frontend/public/brand/backdrop-masthead.jpg
sips -s format jpeg -s formatOptions 72 --resampleWidth 1600 brandkit/backdrop-card.png --out frontend/public/brand/backdrop-card.jpg
ls -l frontend/public/brand/*.jpg
```

Expected: each file under 200 KB (lower `formatOptions` by 10 and rerun if not).

- [ ] **Step 7: Record spend and commit.** Append each job id, model, credits and approval outcome to `brandkit/prompts.md`, then run `higgsfield account status` and record the remaining balance.

```bash
git add brandkit/prompts.md frontend/public/brand/atlas-3d.png frontend/public/brand/backdrop-*.jpg
git commit -m "feat(brand): Higgsfield 3D logo render and backdrops"
```

(Raw attempt PNGs in `brandkit/` are not committed: add `brandkit/*.png` to `.gitignore` in this commit.)

---

### Task 8: Wire imagery into the app and share card

**Files:**
- Modify: `frontend/src/routes/BriefingLayout.tsx:3, 13, 25-27`
- Modify: `frontend/src/routes/briefing-layout.css`
- Modify: `frontend/src/routes/ArchivePage.tsx:66-71`
- Modify: `frontend/src/routes/NotFound.tsx`
- Modify: `frontend/src/routes/archive.css`, `frontend/src/app.css`
- Create: `frontend/scripts/brand/og-card.html`, `frontend/public/brand/og-card.png`
- Modify: `README.md` (header image)

**Interfaces:**
- Consumes: `/brand/atlas-3d.png`, `/brand/backdrop-masthead.jpg`, `/brand/backdrop-card.jpg` (Task 7), `/brand/atlas-lockup-reversed.svg` (Task 5), `render.sh` (Task 6).

- [ ] **Step 1: Masthead backdrop.** In `BriefingLayout.tsx` remove the `Contours` import, the `MASTHEAD_CONTOURS` constant and the `<Contours centers={MASTHEAD_CONTOURS} />` element. In `briefing-layout.css` replace the existing line `.masthead-band { position: relative; overflow: hidden; }` with:

```css
.masthead-band {
  position: relative;
  overflow: hidden;
  background-color: var(--oat-deep);
  background-image:
    linear-gradient(180deg, rgba(238, 232, 220, 0.86), rgba(238, 232, 220, 0.94)),
    url('/brand/backdrop-masthead.jpg');
  background-size: cover;
  background-position: center 70%;
}
@media print {
  .masthead-band { background: none; }
}
```

The oat overlay keeps masthead text contrast independent of the image; `background-color` is the fallback when the image is missing. If the masthead backdrop was rejected in Task 7, omit the `url(...)` layer and keep only the gradient and colour.

- [ ] **Step 2: Empty archive and Not found use the 3D render.** In `ArchivePage.tsx`, inside `<div className="saved-empty">`, insert as the first child:

```tsx
          <img className="brand-object" src="/brand/atlas-3d.png" alt="" width="160" height="160" />
```

In `NotFound.tsx`, insert the same `<img className="brand-object" … />` line as the first child of the `<section>`. In `app.css` add:

```css
.brand-object { display: block; width: 160px; height: 160px; object-fit: contain; margin-bottom: 8px; }
```

If the 3D render was rejected in Task 7, use `src="/brand/atlas-mark.svg"` with `width="96" height="96"` instead.

- [ ] **Step 3: Share card template** at `frontend/scripts/brand/og-card.html`:

```html
<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    position: relative; color: #F3EEE3; font-family: 'Jost', Futura, sans-serif;
    background: #34503C url('../../public/brand/backdrop-card.jpg') center / cover;
  }
  .copy { position: absolute; left: 84px; top: 50%; transform: translateY(-50%); display: grid; gap: 26px; width: 560px; }
  .lockup { height: 64px; width: auto; }
  h1 { margin: 0; font-weight: 400; font-size: 64px; line-height: 1.04; letter-spacing: -0.01em; }
  p { margin: 0; font: 500 18px/1.2 'IBM Plex Mono', monospace; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(243, 238, 227, 0.8); }
  .object { position: absolute; right: 60px; top: 50%; transform: translateY(-50%); width: 470px; height: 470px; object-fit: contain; }
</style></head>
<body>
  <div class="copy">
    <img class="lockup" src="../../public/brand/atlas-lockup-reversed.svg" alt="">
    <h1>Brief me on any place or policy.</h1>
    <p>What changed · where · what to read next</p>
  </div>
  <img class="object" src="../../public/brand/atlas-3d.png" alt="">
</body></html>
```

If the card backdrop was rejected, replace the `background` with `radial-gradient(70% 110% at 92% 110%, rgba(181, 83, 46, 0.7), transparent 60%), #3D5A45`. If the 3D render was rejected, set the `.object` `src` to `../../public/brand/atlas-mark-reversed.svg` and its size to 300px.

- [ ] **Step 4: Render the card.**

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend" && scripts/brand/render.sh scripts/brand/og-card.html public/brand/og-card.png 1200 630`
Expected: `pixelWidth: 1200` / `pixelHeight: 630`. Open it and check the lockup, headline and 3D object are all inside the frame and the text is readable.

- [ ] **Step 5: README header.** Insert directly under `# Atlas` in `README.md`:

```markdown
<p align="center"><img src="frontend/public/brand/og-card.png" alt="Atlas: brief me on any place or policy" width="720"></p>
```

- [ ] **Step 6: Full verification.**

Run: `cd /tmp/atlasbrief/frontend && npx tsc -b && npx oxlint && npx vitest run && npx vite build`
Expected: clean typecheck and lint, `95 passed`, build succeeds and `dist/brand/` contains every file from `public/brand/`.

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && grep -rn "Atlas Brief" frontend/src frontend/index.html README.md`
Expected: no output.

- [ ] **Step 7: Manual pass** (dev server: `cd /tmp/atlasbrief/frontend && npx vite`): favicon visible in the tab in light and dark macOS appearance; nav lockup at desktop width and at 375 px (links still fit); headings render in Jost and body in Hanken (DevTools > Computed > rendered fonts); primary buttons are moss with oat text; terracotta appears only on hotspots, high alerts, the logo dot, focus rings and the active tab; masthead backdrop shows behind the briefing header and disappears in print preview; empty archive and 404 show the 3D object.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src frontend/scripts/brand/og-card.html frontend/public/brand/og-card.png README.md
git commit -m "feat(brand): masthead backdrop, 3D object on empty states, share card"
```
