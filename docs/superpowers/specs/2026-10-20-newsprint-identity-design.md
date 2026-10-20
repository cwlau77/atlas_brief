# Atlas "Newsprint & Ultramarine" identity refresh: design spec

**Date:** 2026-10-20
**Status:** Implemented on branch `brand/newsprint-identity`.
**Implementation notes (deviations from this spec):**
- `--ink-3` is `#636A75`, not `#717985`, to reach AA contrast on paper and paper-deep.
- `--warm` is `#C27400`, not `#E58A00`, so heat markers get 3:1 against paper.
- The route palette was implemented in Task 2, not Task 5.
- The `::first-letter` uppercase rules were replaced with a TSX `upperFirst` helper.
- The footer wash is stronger than the example filter here: brightness 1.55, contrast 0.5, opacity 0.8, a paper veil at 0.45, and a paper backing behind the base line.
**Builds on:** the brand identity spec (`2026-10-18-atlas-brand-identity-design.md`) and the Oat redesign (`2026-10-16-oat-redesign-design.md`). Their logo geometry, page structure, components and globe engine stay. This spec supersedes their palette, typography and label rules.
**Exploration board:** visual companion session `.superpowers/brainstorm/50373-1792471787/content/` (`identity-directions.html` direction C, `footer-treatments.html` option 2, `logo-recolour.html` option B).

## 0. Where this sits

An external design review (2026-10-20) produced a batch of feedback. It splits into five projects, done in this order:

1. **Identity refresh (this spec)**, including the footer cutoff fix and cursor removal.
2. Briefing page: timeline moved first, globe zoom that follows the reader, imagery on alerts and timeline cards.
3. Home page: smoother rotating headline, value-prop copy and an explanation of the source count, a live news ticker replacing the "Trending now" chips, and a dedicated loading screen with an interactive globe.
4. Hotspots tab: a new top-level page showing news-intensity markers (red/amber) on the globe plus a flat map view.
5. (Folded into 1.) Footer cutoff.

Each later project gets its own spec. Nothing in projects 2 to 4 is in scope here.

## 1. Intent

Atlas reads as too relaxed (green/beige) and too AI-template (uppercase mono eyebrows, smoothed cursor) for what it does. The audience is anyone who follows world events seriously. One important group is the student writers at Georgetown's global think tank, who use it to research articles. Atlas needs to look like a **serious, confident instrument** that conveys immediacy, urgency and clarity.

**Owner principle:** this is a **reshape, not a rebuild**. The same pages, components, routes, globe engine and features stay. What changes is the skin (colour, type, labels, corners, shadows) and a visible grid structure around the existing layouts. A builder should not rewrite components when restyling them will do.

**What the reviewer liked (protect these):** the hero and globe animation, the footer, the trending section's purpose, and "From the archive."

## 2. Goals, non-goals, anti-goals

**Goals**
- Replace the oat/celadon palette with Newsprint & Ultramarine (section 3).
- One type family, IBM Plex Sans, everywhere (section 4).
- Sentence-case labels in the body font, replacing uppercase mono eyebrows (section 5).
- A visible, geometric grid: hairline rules dividing sections, square corners, no drop shadows (section 6).
- Recolour the logo and re-set its wordmark (section 7).
- Footer: white-wash the mountain painting and fix the "atlas" lockup cutoff (section 8).
- Remove the custom cursor (section 9).
- Restyle the globe to match (section 10).

**Non-goals**
- Any change to page order, sections, features, copy (beyond label casing) or backend.
- The home ticker, headline animation, loading screen, value-prop copy, imagery and hotspots tab (later projects).
- Dark mode. The site stays light-only.

**Anti-goals (a failure even if it technically works)**
- A rebuild that replaces components or changes behaviour while restyling them.
- Small caps or uppercase-tracked mono anywhere in the UI.
- Ultramarine so rare that it reads as disconnected again. It must visibly carry interaction.
- Red or amber used decoratively. They mean urgency or heat and nothing else.
- Losing the atmosphere entirely. The footer painting stays.

## 3. Colour

All colour lives in `frontend/src/styles/tokens.css`. Token names change to describe roles, not hues. Every component that references the old tokens is updated (current references: `app.css`, `base.css`, `askform.css`, `cards.css`, `story.css`, `cursor.css` (deleted), `footer.css`, `navbar.css`, `timezone.css`, `toast.css`, `globe.css`, `archive.css`, `briefing-layout.css`, `home.css`, `settings.css`, `signals.css`, `SignalsTab.tsx`, `lib/routes.ts`, `Footer.tsx`, `AtlasMark.tsx`).

| Role | Token (new) | Value | Replaces |
|---|---|---|---|
| Page background | `--paper` | `#F5F5F1` | `--oat` `#EEE8DC` |
| Raised surface / deep band | `--paper-deep` | `#EBEBE6` | `--oat-deep`, old `--paper` |
| Primary text, primary buttons, wordmark | `--ink` | `#0E1116` | `--ink` `#1C231F`, `--celadon-deep` as text |
| Secondary text | `--ink-2` | `#3F4752` | `--ink-2` |
| Tertiary text, meta | `--ink-3` | `#717985` | `--ink-3` |
| Grid rules | `--rule` | `#DADBD5` | `--rule` |
| Strong rules, input borders | `--rule-strong` | `#B9BBB3` | `--sand`, `--rule-soft` (merge) |
| Highlight | `--accent` | `#1F3FE0` | `--signal`, `--celadon` |
| Highlight pressed | `--accent-press` | `#1832B8` | `--signal-ink`, `--celadon-press` |
| Highlight wash | `--accent-wash` | `rgba(31, 63, 224, 0.08)` | `--signal-wash`, `--celadon-wash` |
| Heat: high | `--hot` | `#E2381B` (text on paper: `--hot-ink` `#B8280F`) | high-alert role of `--signal` |
| Heat: elevated | `--warm` | `#E58A00` (text on paper: `--warm-ink` `#8F5600`) | `--ochre` |

**Where ultramarine goes:** button hover and focus fills (primary buttons are ink at rest and turn ultramarine on hover), links and their hover, the active tab, focus rings, selected states, the highlighted word in the hero headline, globe route arcs and the logo panels.

**Where red and amber go:** alert severity markers (high = red, medium = amber), the "Live" tag on the future ticker, globe/hotspot heat markers and errors (red). Nowhere else. The archive's favourite stars (`.thread-star`, `.star-btn.on`, currently `--ochre`) become `--accent`, because they mark a selected state. *(My call.)*

Contrast: all text pairs must meet WCAG AA (4.5:1 body, 3:1 large text and UI graphics). `--accent` on `--paper` is about 6.9:1, so it is fine as text. Plain `--hot` and `--warm` are for graphics only. Use the `-ink` variants for text. The builder verifies every pair.

`index.html` `theme-color` becomes `#F5F5F1`.

The paper-grain overlay in `base.css` stays but is retinted to a neutral cool grey (it is currently warm brown) and kept subtle. *(Builder's call on exact strength.)*

## 4. Typography

- **IBM Plex Sans** (Google Fonts, weights 400, 500, 600, plus italic 400 if any italics exist) is the only family. `--font-sans` and `--font-display` both point to it. Delete `--font-mono` and replace its uses with `--font-sans` plus `font-variant-numeric: tabular-nums` where numbers align (timestamps, coordinates, counts).
- `index.html` requests only IBM Plex Sans. Jost, Hanken Grotesk and IBM Plex Mono are no longer loaded.
- Headlines: Plex Sans 600, tight tracking (about −0.03em at display sizes). Body: 400. Labels: 500.

## 5. Labels and eyebrows

The `.label` rule in `base.css` (uppercase, 0.08em tracking, mono) becomes:
- IBM Plex Sans 500, about 0.8rem, **sentence case**, no letter-spacing, tabular numbers, colour `--ink-2`.
- Section eyebrows ("Priority alerts · Read first", "Key developments · 5 events") get a small 8px square marker in `--accent` before the text. Severity tags use a square in `--hot` / `--warm` instead.
- Any label strings that are authored in uppercase in source are rewritten to sentence case. Nothing should rely on `text-transform: uppercase`. The existing `::first-letter` capitalisation rules on titles stay.

## 6. Grid, corners, shadows

Reference: aiuc-1.com's organisational layout. Thin rules visibly divide the page into rectangular cells.

- **Hairline rules (1px `--rule`)** separate the main structural regions on every page: the nav bar bottom, hero copy from hero globe, section from section, and the columns in multi-column regions (story lead column vs. globe, timeline vs. side content, footer columns). Rules run edge to edge within the `--maxw` container.
- Use the existing layouts. Add rules to the grids and flex rows that already exist. Do not re-flow content into a new 12-column system unless a region has no grid today. *(Builder's call where it's ambiguous.)*
- **Cards** (alert callouts, development cards, story cards, archive items, settings panels, dialogs, toasts) lose `border-radius` and shadow. They become ruled cells: a 1px border or shared rules with neighbours, with flat `--paper` or `--paper-deep` fill.
- **Corners:** `--radius` and `--radius-sm` become `0`. Exceptions: genuinely circular things (globe, map markers, status dots, avatar-like icons) stay round. Source chips become square-cornered tags.
- `--shadow-lift` is removed. Hover lift is replaced by a border colour change to `--rule-strong`, or `--accent` for interactive cells.

## 7. Logo

Geometry from the 2026-10-18 spec is unchanged. Colours (option B):

| Part | Default (on paper) | Reversed (on ink) |
|---|---|---|
| Left fold | `#AEBBF5` | `#D5DCFA` |
| Centre panel | `#5A73EA` | `#8FA2F3` |
| Right fold | `#1F3FE0` | `#5A73EA` |
| Fix (peak dot) | `#E2381B` | `#FF6A4D` |

- Wordmark: lowercase "atlas" in **IBM Plex Sans 600**, colour `--ink` on paper and `#F5F5F1` on ink. It keeps the existing proportions (mark height 0.92 × font size, gap 0.28em) unless they look wrong with Plex, in which case it's the builder's call.
- Update `AtlasMark.tsx` (`ATLAS_MARK_PALETTES`) and regenerate every file in `frontend/public/brand/`: `atlas-mark.svg`, `atlas-mark-reversed.svg`, `atlas-lockup.svg`, `atlas-lockup-reversed.svg` (text outlined to paths in Plex Sans 600), `favicon.svg` (keeps its `prefers-color-scheme: dark` switch to the reversed palette), `favicon-32.png`, `favicon-16.png`, `apple-touch-icon.png` (mark on `#F5F5F1`), and `og-card.png` (1200×630, re-composed in the new palette and type).
- Reuse the existing brand tooling in `frontend/scripts/brand/` (`outline_wordmark.py`, `render.sh`, `og-card.html`). `outline_wordmark.py` is pinned to Jost, so point it at IBM Plex Sans 600.

## 8. Footer

- Keep the mountain painting (`/brand/mountains.jpg`, `@2x`) and the layout. Apply the **white-wash** treatment, desaturated and lifted toward paper: about `filter: grayscale(1) brightness(1.35) contrast(0.7); opacity: 0.85`, matching `footer-treatments.html` option 2. A pre-processed image file is acceptable instead of a CSS filter. *(Builder's call; a baked file is lighter at runtime.)*
- `.mountain-band` background becomes paper-coloured, not `--celadon-deep`. The top fade gradient uses `--paper`. The `.footer-base` strip (© line) becomes `--ink-2` text with no dark gradient, since the image is now light.
- **Cutoff fix:** the giant "atlas" lockup's glyph bottoms are currently clipped by the mountain band (`line-height: 0.78` plus `margin-bottom: -0.08em` let the band paint over them). Every glyph must render whole at every viewport width. The band may still sit close beneath the word.
- The lockup uses the new mark colours and Plex Sans.
- The "13 sources · last 24 hours" text is untouched here. The home page project revisits source-count messaging.

## 9. Cursor

Remove `CursorLens.tsx`, `cursor.css`, `cursorBus.ts`, `CursorLens.test.tsx`, its mount in `App.tsx`, and every `data-cursor` attribute (about 24 files). The system cursor returns. The cursor bus's only non-lens job is the globe coordinate readout, which moves to the globe itself (section 10). Pass it from `GlobeView` by prop or local state, not through a global bus.

## 10. Globe

Engine, interaction and behaviour are unchanged. Only colours change (`globe/engine.ts` constants and `globe.css`):
- Ocean point cloud: a light cool grey (around `#C9CCD2`). Land points: ink-toned (around `#3F4752`). The globe should read as a printed, paper-white sphere. *(Builder tunes the values by eye.)*
- `ARC_LIT` / `uHot` (the hover and lit state): `--accent` `#1F3FE0`.
- **Route colours (owner decision: a new set of distinguishable colours).** `lib/routes.ts` currently hands each story route one of five colours (`--ochre`, `--ink`, `--celadon`, `--sand`, `--celadon-deep`), used for its globe arc (`globe/arcs.ts`), its timeline segments (`Timeline.tsx`, `--route`) and its legend swatch (`RouteKey.tsx`). Keep that behaviour and replace the five colours with new `--route-1` to `--route-5` tokens drawn from the new palette. Proposed starting values, in assignment order: ultramarine `#1F3FE0`, ink `#0E1116`, cerulean `#0B7FA8`, slate `#717985`, periwinkle `#5A73EA`. Each must reach at least 3:1 against `--paper` as a UI graphic and be distinguishable from its neighbours in the legend and on the globe. The builder may tune the values to meet that. None may be red or amber. Contradiction routes stay dashed. Update `arcs.test.ts` and `routes.test.ts`. *(The proposed values are my call. The owner chose the approach.)*
- **Coordinate readout (owner decision: keep it).** The live lat/long readout that the engine computes (`engine.ts`, around line 509) and `GlobeView.tsx` currently passes to `CursorLens` through `cursorBus.setGlobeReadout` moves to a small fixed label in the globe's bottom-left corner. It uses tabular figures in `--ink-3` and is shown only while the pointer is over the globe. Hidden from assistive tech (`aria-hidden`), as it is decorative.
- Story point markers: ink at rest, ultramarine when hovered or focused. Alert-linked points use `--hot`.
- `StaticGlobe.tsx` (the no-WebGL fallback) matches.

## 11. Tests and verification

- Rewrite `palette.test.ts` for the new palette: assert that no celadon, oat, moss, Jost, Hanken or Plex Mono values or tokens remain in source, and that the new tokens exist with their values.
- Update `brand.test.ts` and `AtlasMark.test.tsx` for the new logo colours and favicon dark-mode values.
- Update any test that asserts on old tokens, label casing or `data-cursor`.
- `npm run build`, `npm run lint` and `npx vitest run` pass.
- Visual check of Home, a briefing (Story and Signals tabs), Archive, Settings, Not found and the footer at phone width (375px) and desktop, including keyboard focus rings and `prefers-reduced-motion`.

## 12. Docs

Update `CLAUDE.md` ("brand primary is celadon … signal colour is royal blue") and the token comment header in `tokens.css` to describe Newsprint & Ultramarine. Mark the 2026-10-18 spec's palette and type sections as superseded by this one. Update the auto-memory note that says a rebrand is pending.

## 13. Left to the builder

The exact grain strength, globe point colours and wordmark spacing (tuned by eye); final route-colour values within the section 10 constraints; where hairline rules go in regions with no grid today; and the CSS filter vs. baked footer image.
