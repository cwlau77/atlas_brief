# Atlas Brief "Oat" redesign: design spec

**Date:** 2026-10-16
**Status:** Approved in brainstorming, pending spec review
**Replaces:** the "Midnight Signal" dark UI (commit 93c9d66)
**Prototype:** https://claude.ai/artifact/EVzdhDvpHR4KhdXmvShian (throwaway spike; type pairing B chosen)

## 1. Intent

Atlas Brief should feel like a distinctive, premium modern SaaS product instead of a templated AI demo. The redesign changes the look, motion and page structure. Features and data stay the same, with two additions: a time-zone setting and the outlet list on the Signals tab.

**User requirements (stated):**
- Light theme only: oat, terracotta and green.
- Modern clean typography with a serif accent. No Geist or Instrument Serif.
- Liquid-grain particle globe that reacts to the cursor; a custom coordinate-lens cursor.
- Grain/contour background instead of the grid.
- Impressive hero: rotating "Brief me on…" headline, "Ask Atlas" input, first-load intro.
- Storytelling timeline with lines connecting cards that draw as you scroll.
- More refined analytics that no longer read like a slide deck.
- The briefing globe keeps its interactive layer: hover a region point to see its stories and sources.
- A multi-page app with real URLs, not one continuous page.
- A time-zone setting (UTC, Eastern and so on).

**Assumptions:**
- WCAG AA contrast for all text; reduced motion fully respected.
- Existing localStorage data (saved briefings, stars, profile, settings) keeps working.
- Backend API unchanged.

**Success criteria:**
- Every page renders in the new system; no Midnight Signal tokens, fonts or grid remain.
- Each route works on direct load and with the back button in dev and on Vercel.
- Briefing globe hotspots open panels listing that region's developments and sources, and clicking one scrolls to the development.
- Changing the time zone in Settings updates every displayed time immediately.
- Unit tests pass for the new pure logic (section 9); the build and lint pass.
- Initial JS for `/` stays at or below today's entry chunk (110 KB gzip); the globe chunk shrinks from ~580 KB to ~150-200 KB gzip.

## 2. Pages and routing

React Router (data-less `BrowserRouter`), loaded in the entry chunk.

| URL | Page | Contents |
|---|---|---|
| `/` | Home | Hero: eyebrow clock, rotating headline, Ask Atlas form, topic chips, provenance line, hero globe |
| `/brief/:id` | Briefing, Story tab | Masthead, docked briefing globe, priority alerts, timeline, reading list |
| `/brief/:id/signals` | Briefing, Signals tab | Analytics (section 6) |
| `/archive` | Archive | Saved briefings: open, star, delete, compare two, print |
| `/settings` | Settings | Profile, time zone, auto-save, historical context, compact layout |
| `*` | Not found | Message and link home |

**Flow**
- Submitting on Home calls the API while staying on Home. The hero globe enters a "scanning" state and the submit button shows progress. On success: store the briefing (archive if auto-save is on, session slot always), then navigate to `/brief/:id`.
- Generation errors render inline beneath the Ask field with a Retry button. Toasts are only for confirmations and storage failures.
- The Briefing layout header holds a compact Ask field so a new brief can start from any briefing.
- Nav: wordmark → `/`; Briefing → the most recent briefing (session slot, else newest saved, else `/`); Archive; Settings. The active item is highlighted.
- On route change, focus moves to the page's `h1`/`h2` and scroll resets to the top. Back/Forward restores the previous scroll position via a small `useScrollRestoration` hook keyed by location key (React Router's built-in `ScrollRestoration` requires a data router, which this app doesn't use).
- Print: Archive's Print navigates to `/brief/:id?print=1`. The Story tab calls `window.print()` after its first paint when that parameter is present, then removes the parameter with `replace`.

**Briefing resolution** (`useBriefing(id)`): look up the session slot, then saved briefings. If neither has it, render "This briefing isn't saved on this device" with a "Start a new brief" link to `/`.

## 3. State

`src/state/AppState.tsx` exposes one provider and focused hooks:
- `useArchive()`: saved briefings, starred IDs, save, remove, toggle star. Persists via the existing `storage.ts` keys and shape.
- `useSessionBriefing()`: the latest generated briefing, mirrored to `sessionStorage` so a refresh keeps it.
- `useSettings()`: `{ timeZone, autoSave, showHistoricalContext, compactMode }` plus setters. Persisted under the existing settings key; `timeZone` is a new optional field.
- `useProfile()`: unchanged profile fields.

Settings are live: consumers re-render when they change. This removes the direct `loadSettings()` reads in `App.tsx` and `BriefingView.tsx`.

## 4. Visual system

**Tokens** (`styles/tokens.css`):

| Token | Hex | Use |
|---|---|---|
| `--oat` | `#EEE8DC` | page ground |
| `--oat-deep` | `#E4DCCB` | pressed and selected fills |
| `--paper` | `#F8F4EB` | cards and surfaces |
| `--ink` | `#1C231F` | primary text |
| `--ink-2` | `#48524B` | secondary text |
| `--ink-3` | `#646A60` | muted labels (AA on oat) |
| `--rule` | `#D6CDBA` | dividers, outlines |
| `--rule-soft` | `#E2DACA` | subtle card outlines, bar tracks |
| `--moss` | `#3D5A45` | data, globe land, reached nodes |
| `--sage` | `#9AAA92` | secondary data, ocean grain |
| `--sand` | `#C7B89C` | tertiary data, inactive lines |
| `--terra` | `#B5532E` | the single CTA, cursor, hotspots, routes, high severity marks |
| `--terra-ink` | `#93421F` | terracotta text |
| `--ochre` | `#9C7026` | medium severity marks |

Severity is always shape plus label: ▲ high (terra), ■ medium (ochre), ○ low (ink-3).

**Type:** Google Fonts. Hanken Grotesk 300-800 (UI, headlines), Fraunces italic with `SOFT 100` (accent words), IBM Plex Mono 400/500 (labels, data, times). Scale: display `clamp(3rem, 7.4vw, 6.6rem)`, h2 `clamp(2.2rem, 4.6vw, 3.8rem)`, h3 1.28rem, body 16px / 1.55, mono labels 0.72rem uppercase with 0.08em tracking. Headings use `text-wrap: balance`; figures use tabular numerals.

**Background:** a fixed paper-grain overlay (inline SVG turbulence tile, multiply) on all pages. A topographic contour canvas appears only behind the Home hero and the briefing masthead.

**Motion tokens:** `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`; micro-interactions 150-300 ms; entrances ≤ 900 ms. Under `prefers-reduced-motion`: no intro, no rotating words or typewriter, no liquid globe response, no auto-spin, native cursor, instant transitions.

**Removals:** Geist, Geist Mono, Instrument Serif, the graph-grid ambient layer, glow blobs, conic ring, chart.js, react-globe.gl.

## 5. Globe

`src/globe/` (lazy chunk, three.js only):
- `GlobeView.tsx`: React wrapper. Props: `mode: 'hero' | 'briefing'`, `regions?: RegionPoint[]` (name, lat, lng, count, developments with anchor IDs and sources), `onSelectDevelopment?(anchorId)`.
- `engine.ts`: renderer, camera, land, ocean and hotspot point clouds, occluder sphere, shaders, frame loop. Imperative class with `setRegions`, `setPointer`, `dispose`.
- `land-points.ts`: generated at build time by `scripts/build-land-points.mjs` from `world-atlas/land-110m.json`: Fibonacci sphere of 60k samples, land only, latitude > -60°, encoded as base64 Int16 lat/lng × 100 (~16k points). Committed; regenerated by `npm run build:land`.
- `controls.ts`: pointer-drag rotation with momentum and pitch clamped to ±0.6 rad. No zoom. Auto-spin pauses on interaction and resumes after 4 s idle.

**Hero mode:** intro assembly (scattered points spring into the sphere over ~1.9 s, staggered), first load per session only (sessionStorage flag), skipped by any click or key. Slow spin; liquid cursor response (noise drift plus radial push and ripple near the pointer, tinting toward terra). Four decorative hotspots and no data panels.

**Briefing mode:**
- One terracotta hotspot per region in `regionCounts` that `resolveRegion` can place, sized by count. On mount the camera eases to the region with the most mentions.
- Hover or keyboard focus opens a panel (React, positioned by projecting the point each frame and flipped to stay inside the globe bounds): region name, mention count, its developments (title, time in the user's zone, source names). Clicking a development calls `onSelectDevelopment`, which scrolls to `#dev-N`. Clicking a hotspot pins its panel; Escape or clicking outside unpins. Panels for back-facing points hide.
- Hotspots are rendered as focusable buttons in an overlay layer so Tab reaches them; a visually hidden list of regions and developments mirrors the panels for screen readers.

**Performance and fallback:** device pixel ratio capped at 2; rendering pauses when off-screen (IntersectionObserver) or the tab is hidden; resources disposed on unmount. If WebGL context creation fails, render a static grain SVG plus the region list.

## 6. Briefing pages

**Masthead (both tabs):** topic as h1, issue time in the user's zone, cadence, counts, and the Story / Signals tab bar (links, `aria-current="page"`). On Story, the briefing globe sits beside the masthead on wide screens and below it on narrow ones.

**Story tab:**
- Priority alerts as a callout block above the spine.
- Timeline: developments sorted by `timestamp` ascending. Each row has a time label (user's zone), a node on the spine, and the development card (priority mark, region tags, title, content, optional historical context, sources).
- Spine fill tracks scroll: filled up to 60% of the viewport height. Nodes above that line turn moss.
- Branches: `linkBriefing(briefing)` (pure, tested) returns for each tension and contradiction the development indexes it relates to. A tension relates to a development when any of the development's `regions` appears (case-insensitive, whole word) in the tension's `actors` or `description`. A contradiction matches the same way against its `topic`, `account_a` and `account_b`. Items with no match go to an "Also in this briefing" group after the timeline.
- Wide screens (≥ 980px): linked cards in a right column aligned with their first related development; an SVG overlay draws a faint curve for every link and a terracotta curve that draws in when its development crosses the reading line. Layout recomputes on resize and font load.
- Narrow screens: one column, linked cards indented under their first development, spine and curves hidden.
- Reading list closes the timeline.
- Settings: historical context off hides context paragraphs; compact layout reduces card padding and row gaps.

**Signals tab:**
- Summary sentence from `summarizeSignals(briefing)` (pure, tested): names the top region and its share of regional mentions, and the leading source type and its share. Template-based, no model call.
- Stats strip: articles, sources, regions, alerts, separated by hairlines.
- Source mix: one stacked bar (moss, sage, sand) with legend, percentages and counts.
- Regions: top 8 rows with direct labels, the top row in terra.
- Outlets: top 8 from `outletCounts`.
- Each block has an empty state when its data is missing.

## 7. Time zone

- Stored as an IANA name in settings (`timeZone`); default `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Settings control: a searchable combobox over `Intl.supportedValuesOf('timeZone')` (with a short built-in list as fallback where unsupported), each option labeled with its city and current UTC offset, plus "Use my device's time zone".
- `src/lib/time.ts` (pure, tested): `formatTime(iso, tz)` → `14:32 EDT`, `formatDateTime(iso, tz)`, `formatClock(now, tz)`, `isValidTimeZone(tz)`. An invalid zone falls back to the device zone. `relativeTime` stays as is.
- Used by: hero eyebrow clock, masthead issue time, timeline labels, globe panels, archive dates, compare view.

## 8. Cursor

`src/components/CursorLens.tsx`, mounted once in the app shell. A terracotta dot follows the pointer; a ring follows with easing. Modes set by `data-cursor` attributes or element type: default, `link` (ring grows, tinted fill), `text` (ring becomes a 2×26 bar), `globe` (dashed ring with crosshair and a lat/lng readout fed by the globe engine). Enabled only when `(pointer: fine)` matches and reduced motion is off; otherwise the native cursor is untouched. Hidden when the pointer leaves the window.

## 9. Testing

Unit tests (vitest, run from the `/tmp/atlasbrief` symlink as documented in `frontend/README.md`):
- `linkBriefing`: region match, case and whole-word rules, multi-link, unmatched items.
- `time.ts`: formatting across zones and DST, abbreviation, invalid-zone fallback.
- `summarizeSignals`: shares and wording, ties, empty data.
- `useBriefing` resolution: session slot, saved, missing.
- Settings provider: default zone, persistence, migration of settings without `timeZone`.
- Existing normalize, storage and centroids tests keep passing.

Manual browser pass before merge: each route on direct load and Back/Forward, hotspot hover/pin/click-through, globe drag, cursor modes, reduced motion, 375px width, print from Archive, WebGL-disabled fallback.

## 10. Build order

Each step leaves the app building and usable:
1. Tokens, fonts, grain background; remove Midnight Signal styling.
2. Router, pages, shared state (`AppState`), Not found and unsaved-briefing states.
3. Time-zone helper and setting.
4. Globe engine, hero mode, briefing mode with hotspot panels; remove react-globe.gl.
5. Story timeline with spine and branches.
6. Signals tab; remove chart.js.
7. Cursor, intro, rotating headline, typewriter placeholder, final polish.

## 11. Out of scope

Dark mode; server-side briefing storage or shareable cross-device links; outlet-origin globe layer; backend changes.
