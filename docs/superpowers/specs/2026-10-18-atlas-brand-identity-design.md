# Atlas brand identity: design spec

**Date:** 2026-10-18
**Status:** Implemented on branch `brand/atlas-identity`.
**Amended 2026-10-18:** royal blue (`#3358C7`) replaces terracotta as the signal colour, including the logo fix; tokens renamed `--terra*` → `--signal*`.
**Superseded 2026-10-20:** the palette, typography and logo colours here are superseded by `2026-10-20-newsprint-identity-design.md` (Newsprint & Ultramarine). Logo geometry still stands.
**Builds on:** the "Oat" redesign (`2026-10-16-oat-redesign-design.md`); its palette, layout and features stay.
**Exploration board:** https://claude.ai/artifact/BBsEVi4WNEiGxYiBTakf2A (five rounds; G5 mark and W1 wordmark chosen)

This is spec 1 of 3 in the UI vision work. Spec 2 covers the spacing system, page layouts and footer. Spec 3 covers story timeline tuning, globe arcs, click-to-zoom and the story carousel.

## 1. Intent

Atlas needs a real identity that the interface grows from, so the product reads as finished and premium rather than templated.

**User decisions (stated):**
- Rename "Atlas Brief" to **Atlas**.
- Brand feel: a precision instrument with an atmospheric world around it (grain, painterly gradients).
- Main colour pairing: **oat with moss green**. Royal blue is the accent (originally terracotta), not a co-lead.
- Logo: the **folded map** mark, original geometry, shaded in **greens only** (multi-hue looked like a flag), with one **royal blue point** at the peak (originally terracotta) (option G5).
- Wordmark: lowercase **"atlas" in Jost** (option W1).
- Type: **Jost** headlines, **Hanken Grotesk** body, **IBM Plex Mono** data. No serif accent.
- Higgsfield credits go to a **3D logo render** and **atmosphere backdrops**. Icons and empty-state art are drawn in SVG.
- The home hero **keeps the globe**. The 3D logo appears in other places.

**Success criteria:**
- No "Atlas Brief" string remains in the frontend, README files or page metadata (deploy service names excepted, see section 2).
- The mark, lockup and favicon set exist as committed files and are used by the app.
- Every heading renders in Jost and every body paragraph in Hanken Grotesk; Fraunces is no longer requested.
- The signal colour (royal blue) appears only in the roles listed in section 4.
- The build, lint and existing tests pass.

## 2. Name and voice

- Product name: **Atlas** in the page title, meta description, Open Graph tags, nav wordmark, footer, Not found page, unsaved-briefing page and both READMEs.
- The verb stays: "Brief me on…", "Brief me", "New brief". "Brief" is an action, not part of the name.
- Unchanged: the Render service name, the Vercel project name, the API `service` field (`atlas-brief-api`), localStorage keys and the backend `User-Agent`. Renaming them forces redeploys or breaks stored data for no user-visible gain.

## 3. Logo system

### Mark (G5)
Folded map: three panels on a 100×100 grid. Geometry is fixed:

| Panel | Path | Oat version | Reversed (on moss) |
|---|---|---|---|
| Left fold | `M8 84 L36 20 L36 76Z` | `#6F8A6F` | `#F3EEE3` |
| Centre panel | `M36 20 L64 32 L64 88 L36 76Z` | `#3D5A45` | `#C9D2C0` |
| Right fold | `M64 32 L92 84 L64 88Z` | `#2A3F31` | `#9AAA92` |
| Fix (peak dot) | `circle cx=36 cy=13 r=5` | `#3358C7` | `#8FA9F2` |

### Lockup (W1)
Mark plus lowercase "atlas" in Jost 500. The mark's height is 0.92 × the font size, and the gap between mark and word is 0.28em. The wordmark colour is moss `#3D5A45` on oat and `#F3EEE3` on moss.

### Files (`frontend/public/brand/`)
- `atlas-mark.svg`, `atlas-mark-reversed.svg`
- `atlas-lockup.svg`, `atlas-lockup-reversed.svg` (text outlined to paths, so they render without the font)
- `favicon.svg` (the mark), `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png` (180 px, mark on oat with padding)
- `og-card.png` (1200×630, see section 6)

`frontend/public/compass.svg` and the old `favicon.svg` are removed; `index.html` points at the new files.

In the app, the nav uses an inline `<AtlasMark>` React component (same geometry, props for `reversed` and `title`) next to the live Jost text "atlas", so it stays crisp and themable.

### Rules
- The mark is only ever drawn in the green family above; the dot is the only blue in the logo.
- Minimum size 16 px for the mark, 80 px wide for the lockup.
- Clear space around the mark equals the dot's diameter × 2.

## 4. Colour roles

Existing tokens in `frontend/src/styles/tokens.css` stay; their jobs tighten, and two moss shades are added because the mark uses them.

| Token | Hex | Role |
|---|---|---|
| `--oat` | `#EEE8DC` | page ground |
| `--paper` | `#F8F4EB` | cards and surfaces |
| `--moss` | `#3D5A45` | **brand primary**: logo, primary buttons, links, timeline, data |
| `--moss-light` (new) | `#6F8A6F` | logo light fold, hover fills, secondary data |
| `--moss-deep` (new) | `#2A3F31` | logo shadow fold, pressed primary buttons |
| `--sage`, `--sand` | `#9AAA92`, `#C7B89C` | supporting data colours |
| `--signal` (was `--terra`) | `#3358C7` royal blue | **signal only**: globe hotspots, priority alerts (high), the logo dot, focus rings and the active nav/tab indicator |
| `--ink`, `--ink-2`, `--ink-3` | as today | text |

Change from today: the primary button (`.btn-primary`) moves from terracotta to moss, and the cursor dot moves from terracotta to moss. The signal colour is kept for things that need attention, so it keeps its meaning.

## 5. Typography

- **Jost** 400 and 500 for display and headings (h1, h2, h3, masthead title, hero headline, card titles, the wordmark).
- **Hanken Grotesk** 400 to 600 for body text, buttons, inputs and navigation.
- **IBM Plex Mono** 400 and 500 for labels, times, counts and data.
- Tokens: `--font-display: 'Jost', 'Futura', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif`; `--font-sans` and `--font-mono` unchanged.
- The Google Fonts request in `index.html` drops Fraunces and adds `Jost:wght@400;500`. The hero's italic serif word (`.serif`, `--font-serif`, `--serif-vars`) becomes upright Jost 400 in moss.
- The type scale from the Oat spec stays; spec 2 revisits sizes and spacing.

## 6. Imagery (Higgsfield)

Budget: 10 credits on the free workspace. Planned spend is about 9; nothing is generated speculatively. Prompts and chosen outputs are saved under `brandkit/` (the brandkit skill's working directory) and the final assets are committed to `frontend/public/brand/`.

**3D logo render** (Seedream 5.0 Pro at 2.5 credits or Nano Banana 2 at 2 credits; at most 2 attempts):
- The G5 folded map as matte folded paper in the three moss tones, the terracotta dot as a small enamel bead at the peak, soft directional light from the left, on an oat ground with gentle grain. The flat SVG mark is passed as a reference image.
- Used in: the share card (`og-card.png`), the empty archive state, the Not found page and the README header. Not in the home hero, which keeps the globe.

**Atmosphere backdrops** (2 images at about 2 credits each):
- Grainy painterly fields in moss and oat with a low terracotta glow, abstract, no objects or text, 16:9.
- Used behind the briefing masthead (replacing the `Contours` canvas there) and as the share card background. Exported as compressed WebP (target under 150 KB each) with a solid moss/oat fallback colour.

If a generation fails quality review after the attempt limit, the fallback is the existing CSS grain plus radial gradients (as on the exploration board), which costs nothing.

## 7. App changes

1. `tokens.css`: add `--moss-light`, `--moss-deep`, `--font-display`; remove `--font-serif` and `--serif-vars`.
2. `index.html`: title "Atlas", new meta description and Open Graph tags (title, description, `og-card.png`), new favicon links, font request without Fraunces.
3. New `src/components/AtlasMark.tsx`; `NavBar` renders the mark plus "atlas" in Jost; `aria-label="Atlas home"`.
4. Headings switch to `--font-display` in `base.css`; `.serif` usages are removed from `HomePage` and `RotatingHeadline`.
5. `.btn-primary` and the cursor dot move to moss; terracotta uses outside the roles in section 4 move to moss.
6. Copy: footer, Not found, unsaved briefing, Archive lede and Home lede say "Atlas".
7. Masthead backdrop image and share card wired in; `Contours` stays on Home only.
8. READMEs: product name, 3D render header image.

## 8. Testing

- Existing vitest suite, `tsc -b` and `oxlint` pass.
- A test that `AtlasMark` renders three panels and the dot, and that `reversed` switches to the reversed palette.
- A repo search confirms no "Atlas Brief" remains outside the exceptions in section 2.
- Manual pass: favicon visible in a browser tab at 16 px, nav lockup at desktop and 375 px widths, share card preview via an Open Graph debugger after deploy, contrast of moss buttons (oat text on `#3D5A45` is about 7:1, above AA).

## 9. Out of scope

Spacing system, page layouts and footer redesign (spec 2). Story timeline tuning, globe arcs, click-to-zoom and the story carousel, article images (spec 3). Icon set and empty-state illustrations beyond reusing the 3D render (drawn later in SVG, spec 2). Renaming deploy services.
