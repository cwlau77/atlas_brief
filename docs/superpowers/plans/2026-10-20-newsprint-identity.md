# Newsprint & Ultramarine Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Atlas frontend from Oat/celadon to Newsprint & Ultramarine (palette, IBM Plex Sans, sentence-case labels, hairline grid, square corners, recoloured logo, white-wash footer) and remove the custom cursor, without changing features or page structure.

**Architecture:** All colour and type flow from `frontend/src/styles/tokens.css`. Tokens are renamed by role, and every reference is migrated in the same task, so no CSS ever points at an undefined variable. Source-scanning vitest suites (the existing `palette.test.ts` / `brand.test.ts` pattern of `import.meta.glob(..., { query: '?raw' })`) enforce the migration. The globe keeps its engine and only changes constants. The coordinate readout moves from the cursor bus to a ref-updated label inside `GlobeView`.

**Tech Stack:** Vite, React 19, TypeScript, plain CSS, three.js, vitest + jsdom, oxlint. Brand assets use `frontend/scripts/brand/` (fontTools + headless Chrome).

**Spec:** `docs/superpowers/specs/2026-10-20-newsprint-identity-design.md`

## Global Constraints

- Reshape, not rebuild: no component rewrites, no behaviour or page-order changes, no backend changes.
- Light-only. No dark theme.
- One family: IBM Plex Sans 400/500/600 (plus italic 400 if italics exist). Jost, Hanken Grotesk and IBM Plex Mono are no longer requested or referenced.
- No `text-transform: uppercase` and no small caps in UI CSS. The `::first-letter` capitalisation rules stay.
- Red (`--hot`) and amber (`--warm`) only for alert severity, heat markers, the future "Live" tag and errors. Never decorative.
- `--radius` and `--radius-sm` are `0`. Only genuinely circular things (globe, markers, status dots) stay round. No `--shadow-lift`.
- WCAG AA: text ≥ 4.5:1 on `--paper` and `--paper-deep`, UI graphics ≥ 3:1.
- All motion respects `prefers-reduced-motion` (existing rule, CLAUDE.md).
- Run all frontend commands from `frontend/`.

## Review Focus

- **Stale token references.** A `var(--celadon)` left in some CSS file silently renders transparent or inherited. Expect every `var(--x)` in `src` to resolve to a declared custom property. Task 2 adds the test.
- **Tertiary text contrast.** The mockup's `--ink-3` `#717985` is only about 4.0:1 on paper and fails AA for small meta text. Expect `--ink-3` to be darkened to `#646B76` (about 4.9:1 on paper, about 4.5:1 on paper-deep). Task 2's contrast test pins every text pair.
- **Footer lockup on phones.** At 375px wide the giant "atlas" must still render every glyph whole above the mountain band. Task 7 adds a CSS assertion, and the final check is visual.
- **Coordinate readout on touch and on leaving the globe.** It must disappear when the pointer leaves or the globe unmounts, and must not re-render React every frame. Task 1 tests that it empties on `null`.
- **Focus visibility after square corners.** Removing radii and shadows must not remove focus rings. Expect a 2px `--accent` outline on every interactive element with `:focus-visible`. Task 3's source test asserts that the global focus rule exists.

---

### Task 1: Remove the cursor lens and move the coordinate readout onto the globe

**Files:**
- Delete: `frontend/src/components/CursorLens.tsx`, `frontend/src/components/CursorLens.test.tsx`, `frontend/src/components/cursor.css`, `frontend/src/components/cursorBus.ts`
- Modify: `frontend/src/App.tsx` (drop import and `<CursorLens />` at line 43)
- Modify: `frontend/src/globe/GlobeView.tsx` (lines 2, 111-112, 134: replace the `setGlobeReadout` calls)
- Modify: `frontend/src/globe/globe.css` (add `.globe-readout`)
- Modify: every file carrying `data-cursor` (`ConfirmDialog`, `NavBar`, `TopicChips`, `Footer`, `AskForm`, `Toast`, `TimeZonePicker`, `briefing/DevelopmentCard`, `Timeline`, `StoryCard`, `SourceChips`, `StoryCarousel`, `LinkedTabs`, `RouteKey`, `ReadingList`, `routes/BriefingLayout`, `SettingsPage`, `ArchivePage`, `NotFound`, `UnsavedBriefing`, `GlobeView`): delete the attribute only
- Create: `frontend/src/globe/readout.ts`, `frontend/src/globe/readout.test.ts`
- Create: `frontend/src/identity.test.ts` (source-scan suite reused by later tasks)

**Interfaces:**
- Produces: `applyReadout(el: HTMLElement | null, text: string | null): void` in `globe/readout.ts`. It sets `el.textContent = text ?? ''` and `el.dataset.visible = String(text !== null)`, and is a no-op for a null element.
- Produces: `frontend/src/identity.test.ts` with a `files` glob identical to `palette.test.ts` line 3, for Tasks 2-4 to extend.

- [ ] **Step 1: Write failing tests**

`readout.test.ts`:
- `applyReadout(el, '15.55° N  41.76° E')` → `el.textContent === '15.55° N  41.76° E'` and `el.dataset.visible === 'true'`
- `applyReadout(el, null)` after that → `el.textContent === ''` and `el.dataset.visible === 'false'`
- `applyReadout(null, 'x')` does not throw

`identity.test.ts`, `describe('cursor removal')`:
- no source file (tests excluded) contains `data-cursor`, `CursorLens` or `cursorBus`

- [ ] **Step 2: Run** `npx vitest run src/globe/readout.test.ts src/identity.test.ts`. Expected: FAIL (module missing, offenders listed).

- [ ] **Step 3: Implement.** Add `applyReadout` to `readout.ts`. In `GlobeView`, render `<span className="globe-readout" aria-hidden="true" ref={readoutRef} data-visible="false" />` inside the wrap, call `applyReadout(readoutRef.current, readout)` in `engine.onFrame`, and call `applyReadout(readoutRef.current, null)` in cleanup (same ref-mutation pattern as `hotRefs`, so there is no React state per frame). `.globe-readout` is absolutely positioned bottom-left (`var(--space-3)` inset), `font-variant-numeric: tabular-nums`, about 0.75rem, `color: var(--ink-3)`, `pointer-events: none`, and `opacity: 0` when `[data-visible="false"]`. Delete the four cursor files, the App mount and every `data-cursor` attribute. Remove any CSS that hid the native cursor (search for `cursor: none`).

- [ ] **Step 4: Run** `npx vitest run && npm run build`. Expected: all pass, tsc clean.

- [ ] **Step 5: Commit** `git commit -m "feat(ui): drop the cursor lens; show globe coordinates in the globe corner"`

---

### Task 2: Palette tokens and migration of every colour reference

**Files:**
- Modify: `frontend/src/styles/tokens.css` (colour block and header comment)
- Modify: every file listed in spec §3 that references old tokens (`app.css`, `base.css`, `askform.css`, `briefing/cards.css`, `briefing/story.css`, `footer.css`, `navbar.css`, `timezone.css`, `toast.css`, `globe/globe.css`, `archive.css`, `briefing-layout.css`, `home.css`, `settings.css`, `signals.css`, `SignalsTab.tsx`, `Footer.tsx`)
- Modify: `frontend/index.html` (`theme-color` → `#F5F5F1`)
- Modify: `frontend/src/styles/base.css:27-36` (grain tint)
- Rewrite: `frontend/src/palette.test.ts`
- Leave for later tasks: `lib/routes.ts` (Task 5), `AtlasMark.tsx` (Task 6), `engine.ts` (Task 5)

**Interfaces:**
- Produces these tokens, exactly: `--paper: #F5F5F1`, `--paper-deep: #EBEBE6`, `--ink: #0E1116`, `--ink-2: #3F4752`, `--ink-3: #646B76`, `--rule: #DADBD5`, `--rule-strong: #B9BBB3`, `--accent: #1F3FE0`, `--accent-press: #1832B8`, `--accent-wash: rgba(31, 63, 224, 0.08)`, `--hot: #E2381B`, `--hot-ink: #B8280F`, `--warm: #E58A00`, `--warm-ink: #8F5600`. (`--ink-3` deviates from the spec's `#717985` for AA. Record this in the tokens comment.)
- Removes: `--oat`, `--oat-deep`, `--rule-soft`, `--celadon-light`, `--celadon`, `--celadon-deep`, `--celadon-press`, `--celadon-wash`, `--sand`, `--signal`, `--signal-ink`, `--signal-wash`, `--ochre`.

Migration map, applied by role (the builder judges each use):

| Old | New |
|---|---|
| `--oat` | `--paper` |
| `--oat-deep`, old `--paper` (raised cards) | `--paper-deep` for bands and insets; `--paper` for cards that become ruled cells |
| `--celadon-deep` as text, labels or headings | `--ink` (headings) / `--ink-2` (labels) |
| `--celadon-deep` as button fill | `--ink` at rest, `--accent` on `:hover`/`:focus-visible` |
| `--celadon-deep` / `--signal` / `--signal-ink` as link, active tab, selected or focus | `--accent` |
| `--celadon`, `--celadon-light` (graphics) | `--accent` (interactive graphics) or `--rule-strong` (inert) |
| `--celadon-wash`, `--signal-wash` | `--accent-wash` |
| `--celadon-press` | `--accent-press` |
| `--sand`, `--rule-soft` | `--rule-strong` / `--rule` |
| `--signal` on high alerts and errors | `--hot` (graphics) / `--hot-ink` (text) |
| `--ochre` on medium alerts | `--warm` / `--warm-ink` |
| `--ochre` on archive favourite stars (`.thread-star`, `.star-btn.on`) | `--accent` |

- [ ] **Step 1: Rewrite `palette.test.ts`** with three tests:
- `defines the newsprint tokens`: `tokens.css` contains each `--name: value` pair above, plus `--space-1: 4px` and `--space-9: 96px` (kept from the old test).
- `leaves no retired colour or token in source`: no non-test file matches `/--(oat|celadon|sand|signal|ochre|rule-soft)\b|B4CCBE|5E8A79|3A5F52|2F4E43|EEE8DC|E4DCCB|3358C7|24408F|9C7026|C7B89C/i`. `lib/routes.ts`, `components/AtlasMark.tsx` and `globe/engine.ts` are exempted with a `// removed in Task 5/6` comment in the test, and Tasks 5-6 delete the exemption.
- `every var() resolves`: collect every `var(--name` in non-test `src` files. Each name must be declared somewhere in `src` as `--name:` (CSS) or `'--name'` (TSX style object).

Add `describe('contrast')` in `palette.test.ts` with an inline `contrast(a: string, b: string): number` (WCAG relative luminance). Assert ≥ 4.5 for `--ink`, `--ink-2`, `--ink-3`, `--accent`, `--hot-ink` and `--warm-ink` on both `#F5F5F1` and `#EBEBE6`, and ≥ 3 for `--hot` and `--warm` on `#F5F5F1`. Read the values by parsing `tokens.css`, not by duplicating them.

- [ ] **Step 2: Run** `npx vitest run src/palette.test.ts`. Expected: FAIL (missing tokens, old offenders).

- [ ] **Step 3: Implement.** Replace the colour block in `tokens.css`, rewrite the header comment ("Newsprint & Ultramarine. Light only."), and migrate each file by the map above. Retint the grain's `feColorMatrix` RGB from warm `0.24 0.22 0.17` to neutral `0.20 0.21 0.23`, with alpha tuned by eye so it stays subtle. Set `theme-color`.

- [ ] **Step 4: Run** `npx vitest run && npm run build && npm run lint`. Expected: pass.

- [ ] **Step 5: Commit** `git commit -m "feat(ui): newsprint and ultramarine palette"`

---

### Task 3: IBM Plex Sans everywhere and sentence-case labels

**Files:**
- Modify: `frontend/index.html:26` (font request)
- Modify: `frontend/src/styles/tokens.css` (`--font-sans`, `--font-display`; delete `--font-mono`)
- Modify: `frontend/src/styles/base.css:75-86` (`.label`) and the mono numeric rule above it
- Modify: the two `var(--font-mono)` users and the seven `var(--font-display)` users (font-family only)
- Modify: any TSX string literal authored in uppercase that renders as a label (search `>[A-Z ·]{4,}<` and constants such as severity names); rewrite to sentence case
- Modify: `frontend/src/brand.test.ts` (font assertions only, if any)
- Test: `frontend/src/identity.test.ts`

**Interfaces:**
- Produces: `--font-sans: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif` and `--font-display: var(--font-sans)`.
- Produces: the `.label` contract: Plex Sans 500, `0.8rem`, `letter-spacing: 0`, `text-transform: none`, `tabular-nums`, `color: var(--ink-2)`. Plus `.label-mark::before`, an 8×8 `--accent` square with `margin-right: var(--space-2)`, used on section eyebrows. Severity tags use `--hot` / `--warm` squares in place of today's diamond (`PriorityMark.tsx`).

- [ ] **Step 1: Add tests** to `identity.test.ts`, `describe('type')`:
- `index.html` requests `family=IBM+Plex+Sans` and contains none of `Jost`, `Hanken`, `IBM+Plex+Mono`
- `tokens.css` has no `--font-mono` and contains `--font-sans: 'IBM Plex Sans'`
- no non-test CSS file contains `text-transform: uppercase`, `small-caps` or `var(--font-mono)`
- `base.css` contains a `:focus-visible` rule with `outline: 2px solid var(--accent)`

- [ ] **Step 2: Run** `npx vitest run src/identity.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Request `family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap`. Headline rules (`--font-display` users) get `font-weight: 600` and about `-0.03em` tracking at display sizes. Apply `.label-mark` to the section eyebrows ("Priority alerts · Read first", "Key developments · N events" and their siblings on Signals, Archive and Settings). Add or adjust the global `:focus-visible` rule in `base.css`.

- [ ] **Step 4: Run** `npx vitest run && npm run build && npm run lint`. Expected: pass. Then `npm run dev` and eyeball Home and one briefing.

- [ ] **Step 5: Commit** `git commit -m "feat(ui): IBM Plex Sans and sentence-case labels"`

---

### Task 4: Hairline grid, square corners, no shadows

**Files:**
- Modify: `frontend/src/styles/tokens.css` (`--radius: 0`, `--radius-sm: 0`, delete `--shadow-lift`)
- Modify: the CSS files using `var(--radius*)` (18 uses) and `var(--shadow-lift)` (8 uses), plus any literal `border-radius`/`box-shadow` on cards, chips, inputs, buttons, dialogs and toasts
- Modify: layout CSS to add 1px `--rule` dividers: `navbar.css` (bottom), `home.css` (hero copy | globe), `briefing/story.css` (`.story-lead` copy | globe; section boundaries), `briefing-layout.css` (masthead bottom, tab bar), `signals.css`, `archive.css`, `settings.css`, `footer.css` (`.footer-cols` columns and top)
- Test: `frontend/src/identity.test.ts`

**Interfaces:**
- Consumes: the tokens from Task 2.
- Produces: the convention that interactive cells take a hover/focus border of `--accent` and inert cells take `--rule-strong` (Task 7 relies on it for footer links).

- [ ] **Step 1: Add tests** to `identity.test.ts`, `describe('geometry')`:
- `tokens.css` contains `--radius: 0` and `--radius-sm: 0` and no `--shadow-lift`
- no non-test CSS file contains `var(--shadow-lift)`
- no non-test CSS `border-radius` value other than `0`, `50%`, `999px` or `var(--radius…)` (circles and pills for dots are allowed; everything else is square)

- [ ] **Step 2: Run** `npx vitest run src/identity.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Add dividers to existing grids and flex rows only, and re-flow nothing. Cards become ruled cells (1px `--rule` border or shared neighbour rules, flat fill). Hover lift becomes a border colour change. Source chips become square tags.

- [ ] **Step 4: Run** `npx vitest run && npm run build && npm run lint`. Then check Home, Story, Signals, Archive, Settings and Not found at 375px and 1280px in `npm run dev`. Expected: tests pass, no horizontal scroll, and rules align at the container edges.

- [ ] **Step 5: Commit** `git commit -m "feat(ui): hairline grid and square geometry"`

---

### Task 5: Globe colours and route palette

**Files:**
- Modify: `frontend/src/lib/routes.ts:22-28` (`ROUTE_COLORS`)
- Modify: `frontend/src/styles/tokens.css` (add `--route-1` … `--route-5`)
- Modify: `frontend/src/globe/engine.ts:115` (`ARC_LIT`), `:226` (ocean `0xB4CCBE`), `:228` (land `0x5E8A79`), `:447` (`uHot`)
- Modify: `frontend/src/globe/globe.css` (marker and label colours, `.globe-static-disc`)
- Modify: `frontend/src/lib/routes.test.ts:17-21`, `frontend/src/globe/arcs.test.ts:32`
- Modify: `frontend/src/palette.test.ts` (drop the routes/engine exemptions)

**Interfaces:**
- Produces: `ROUTE_COLORS: RouteColor[]` = `[{ token: '--route-1', hex: '#1F3FE0' }, { token: '--route-2', hex: '#0E1116' }, { token: '--route-3', hex: '#0B7FA8' }, { token: '--route-4', hex: '#717985' }, { token: '--route-5', hex: '#5A73EA' }]`. `MAX_LANES` stays `ROUTE_COLORS.length`. The builder may tune the hexes, but the tests below must hold.

- [ ] **Step 1: Update tests.**
- `routes.test.ts`: expect the new `ROUTE_COLORS` array above.
- `arcs.test.ts:32`: `color: '#0B7FA8'` (lane 2).
- `palette.test.ts` `describe('contrast')`: each `ROUTE_COLORS[i].hex` ≥ 3 on `#F5F5F1`. Each pair of route colours must differ by at least one of: contrast ratio ≥ 1.25, HSL hue difference ≥ 25°, or HSL saturation difference ≥ 0.3. This is a cheap distinguishability guard. The proposed set passes: slate vs cerulean/periwinkle passes only on saturation. No route hex equals `--hot` or `--warm`. `tokens.css` declares `--route-1`…`--route-5` with the same hexes as `ROUTE_COLORS`.
- Remove the routes/engine exemptions from the retired-colour test.

- [ ] **Step 2: Run** `npx vitest run src/lib/routes.test.ts src/globe/arcs.test.ts src/palette.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Set `ARC_LIT` and `uHot` to `0x1F3FE0`, ocean to about `0xC9CCD2`, land to about `0x3F4752`, and tune alpha/size by eye so the sphere reads as printed paper-white. Hotspot markers are ink at rest and `--accent` on hover/focus. Alert-linked markers use `--hot`. `.globe-static-disc` uses the paper/ink scheme.

- [ ] **Step 4: Run** `npx vitest run && npm run build`. Then view the Home globe and a briefing with routes, hovering an arc and a legend swatch. Expected: tests pass, and arcs, timeline lanes and legend swatches match.

- [ ] **Step 5: Commit** `git commit -m "feat(globe): paper globe and ultramarine route palette"`

---

### Task 6: Logo recolour, Plex wordmark and brand assets

**Files:**
- Modify: `frontend/src/components/AtlasMark.tsx` (`ATLAS_MARK_PALETTES`, header comment)
- Modify: `frontend/scripts/brand/outline_wordmark.py` (font URL and weight, colours)
- Modify: `frontend/scripts/brand/og-card.html` (fonts and colours)
- Regenerate: `frontend/public/brand/atlas-mark.svg`, `atlas-mark-reversed.svg`, `atlas-lockup.svg`, `atlas-lockup-reversed.svg`, `favicon.svg`, `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png`, `og-card.png`
- Modify: `frontend/src/components/AtlasMark.test.tsx`, `frontend/src/brand.test.ts`, `frontend/src/palette.test.ts` (drop the AtlasMark exemption)

**Interfaces:**
- Produces: `ATLAS_MARK_PALETTES = { default: { left: '#AEBBF5', centre: '#5A73EA', right: '#1F3FE0', fix: '#E2381B' }, reversed: { left: '#D5DCFA', centre: '#8FA2F3', right: '#5A73EA', fix: '#FF6A4D' } }`. Geometry unchanged.

- [ ] **Step 1: Update tests.**
- `AtlasMark.test.tsx`: rendered `data-part` fills equal the default palette above. With `reversed`, they equal the reversed palette.
- `brand.test.ts`: `atlas-mark.svg` contains `#AEBBF5`, `#5A73EA`, `#1F3FE0` and `#E2381B`. `favicon.svg` keeps its `@media (prefers-color-scheme: dark)` block, which contains `#D5DCFA`, `#8FA2F3`, `#5A73EA` and `#FF6A4D`. No brand SVG contains `B4CCBE` or `3358C7`.
- Remove the AtlasMark exemption from the retired-colour test.

- [ ] **Step 2: Run** `npx vitest run src/components/AtlasMark.test.tsx src/brand.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Update the palette. In `outline_wordmark.py`, pin the IBM Plex Sans font file to a specific google/fonts commit (same pinning pattern as the Jost URL at lines 17-21), instantiate weight 600, colour the wordmark `#0E1116` (default) and `#F5F5F1` (reversed), keep mark height 0.92 × font size and a 0.28em gap, and update the docstring. Hand-edit the mark and favicon SVGs (the fills are literal). Re-compose `og-card.html` in paper/ink/ultramarine with Plex Sans and no uppercase mono. Render PNGs with `scripts/brand/render.sh` (favicons transparent, apple-touch on `#F5F5F1`, OG at 1200×630).

- [ ] **Step 4: Run** `npx vitest run && npm run build`, and open each regenerated PNG to check it. Expected: pass, and the assets show the B palette.

- [ ] **Step 5: Commit** `git commit -m "feat(brand): ultramarine folded map and Plex wordmark"`

---

### Task 7: Footer white-wash and lockup cutoff fix

**Files:**
- Modify: `frontend/src/components/footer.css`
- Modify: `frontend/src/components/Footer.tsx` (only if the image source changes)
- Optionally create: `frontend/public/brand/mountains-wash.jpg`, `mountains-wash@2x.jpg` (baked treatment; builder's call)
- Test: `frontend/src/components/Footer.test.tsx`, `frontend/src/identity.test.ts`

**Interfaces:**
- Consumes: tokens (Task 2), lockup colours (Task 6).

- [ ] **Step 1: Add tests.**
- `identity.test.ts`, `describe('footer')`: `footer.css` `.footer-lockup` has `line-height` ≥ `0.9` and no negative `margin-bottom`. `.mountain-band` does not reference `--celadon` or `--ink` as its background. `.mountain-band img` has `grayscale(1)` in its filter, *or* `Footer.tsx` references `mountains-wash`.
- `Footer.test.tsx`: the mountain `<img>` still renders with `alt=""` (decorative), and `13 sources · last 24 hours` is unchanged.

- [ ] **Step 2: Run** `npx vitest run src/components/Footer.test.tsx src/identity.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Apply `filter: grayscale(1) brightness(1.35) contrast(0.7); opacity: 0.85` (or bake it). Set the band background to `--paper` and keep the top fade in `--paper`. `.footer-base` becomes `--ink-2` text with no dark gradient. Lockup: raise the line-height and remove the negative margin so the band starts below the glyph baseline plus descent. Footer links use `--accent` on hover.

- [ ] **Step 4: Run** `npx vitest run`. Then check the footer at 375px, 768px and 1440px in `npm run dev`. Expected: pass, and every "atlas" glyph is whole at all three widths.

- [ ] **Step 5: Commit** `git commit -m "fix(footer): white-wash mountains and an unclipped lockup"`

---

### Task 8: Docs and full verification

**Files:**
- Modify: `CLAUDE.md` (the "brand primary is celadon … royal blue" bullet → Newsprint & Ultramarine, IBM Plex Sans)
- Modify: `docs/superpowers/specs/2026-10-18-atlas-brand-identity-design.md` (header note: palette, type and logo colours superseded by `2026-10-20-newsprint-identity-design.md`)
- Modify: `docs/superpowers/specs/2026-10-20-newsprint-identity-design.md` (Status → Implemented; note the `--ink-3` deviation)
- Modify: `~/.claude/projects/-Users-camlau-Developer-atlas/memory/midnight-signal-design.md` and `MEMORY.md` line (rebrand no longer pending)

- [ ] **Step 1: Run** `npm run build && npm run lint && npx vitest run` in `frontend/`. Expected: all pass.
- [ ] **Step 2: Visual pass** in `npm run dev` at 375px and 1280px: Home, a briefing (Story and Signals), Archive, Settings, Not found, the unsaved-briefing page and the footer. Tab through each page to check focus rings. Toggle reduced motion. Disable WebGL (or force `StaticGlobe`) once. Expected: no celadon or beige anywhere, no uppercase mono labels, square cells with hairline rules, and the coordinate readout shows in the globe corner on hover and hides on leave.
- [ ] **Step 3: Update the docs** listed above.
- [ ] **Step 4: Commit** `git commit -m "docs: record the newsprint identity"`
