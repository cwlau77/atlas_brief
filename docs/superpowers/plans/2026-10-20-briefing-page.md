# Briefing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remodel the Story tab so that it shows, in order: a Read first alert strip, then Key developments as a tension index above a newest-first timeline, with a sticky globe that follows card hover. Add images (outlet lead image, else a Wikimedia Commons file photo) to alert and development cards.

**Architecture:** The backend gains `backend/synthesis/commons.py`. It fetches Commons candidates per place while historical context is being written, then assigns distinct files to developments and alerts. On the frontend, pure modules hold the logic: the index model, the image resolver and the follow-state machine. Thin components render it. The lanes, the route key and the per-card tabs are deleted. `lib/routes.ts` keeps assigning arc colours.

**Tech Stack:** FastAPI + httpx + pydantic and pytest on the backend. On the frontend: React 19 + TS, plain CSS, three.js globe, vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-20-briefing-page-design.md`

## Global Constraints

- Reshape, not rebuild. Reuse `Globe`, `StoryCarousel`, `TopStories`, `ReadingList`, `PriorityMark`, `SourceChips` and `DevelopmentCard`, changing them only where a task says so.
- Newsprint & Ultramarine tokens only (`styles/tokens.css`). Square corners, hairline rules, no shadows, sentence-case labels.
- All motion respects `prefers-reduced-motion`. Under it the globe moves instantly; otherwise it eases.
- A failing image lookup never fails a briefing. Its hard budget is **1.5s**.
- Briefings saved before this change (no image fields, ascending order) must still render.
- 375px wide: 16px gutter, `documentElement.scrollWidth` ≤ 375. WCAG AA contrast. Rows and cards are keyboard-operable.
- Commons credit copy: `File photo: {author}, {license}, Wikimedia Commons`, plus a "File photo" label on the image. Outlet credit: `Photo: {image_outlet ?? outlet}`.
- Timers: hover dwell **250ms**, leave-timeline revert **400ms**.
- The backend stays a single process. Caches are in-memory.
- Commit messages end with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Commons slow or down:** `POST /briefing` returns within the existing time plus ≤ 1.5s, with no images and no error. Task 1 test `test_budget_exceeded_returns_empty`.
- **Old saved briefings** (no `commonsImage`, no `image` on alerts) render with outlet images or none, and never crash. Task 3 test `normalizes legacy saved briefing without image fields`.
- **Pointer sweeping across cards** must not zoom the globe until a card holds hover for 250ms. Task 7 test `sweep under 250ms never emits a target`.
- **Touch-primary devices** (`hover: none`): hover-follow is off and tapping a region tag zooms. Task 7 test `touch mode ignores hover and follows tap`.
- **A briefing with no tensions or contradictions, or no developments with a place:** the index is omitted and the globe stays on the overview. Task 4 test `empty briefing yields no index items` and Task 7 test `unresolvable development leaves target unchanged`.

---

### Task 1: Commons lookup module (backend)

**Files:**
- Create: `backend/synthesis/commons.py`
- Modify: `backend/models.py` (add `CommonsImage`, and an optional `commons_image` on `KeyDevelopment` and `PriorityAlert`)
- Modify: `backend/config.py` (`commons_images_enabled: bool = True`), `backend/.env.example` (`COMMONS_IMAGES_ENABLED=true`)
- Test: `backend/tests/test_commons.py`

**Interfaces:**
- Produces: `class CommonsImage(BaseModel): url: str; page_url: str; author: str; license: str; source: Literal["commons"] = "commons"`
- Produces: `async def fetch_candidates(queries: list[str], client: httpx.AsyncClient, budget_s: float = 1.5) -> dict[str, list[CommonsImage]]`. It runs concurrently and returns `{}` entries for queries that time out or fail. It never raises.
- Produces: `def assign_images(briefing: Briefing, candidates: dict[str, list[CommonsImage]]) -> None`. It mutates in place. Developments come first, in order. Then each alert borrows the place of the first development that shares a source URL. No `CommonsImage.url` repeats. Any item that already has an outlet image (`sources[].image_url`) is skipped.
- Produces: `def query_for(dev: KeyDevelopment) -> str | None`, which returns `place.name`, otherwise `regions[0]`, otherwise `None`.

- [ ] **Step 1: Write failing tests** in `test_commons.py`. Mock HTTP with `httpx.MockTransport`, following the existing pattern in `test_trending.py` and `test_gdelt.py`.
  - `test_filters_non_photos`: SVG, `Flag_of_*`, `*map*`, `Coat_of_arms*`, `*logo*`, and widths under 640 are all dropped. A 1024px JPEG is kept.
  - `test_requires_author_and_license`: a file missing `LicenseShortName` or `Artist` is dropped. The `Artist` HTML `<a href>Jane Doe</a>` is reduced to `"Jane Doe"`.
  - `test_budget_exceeded_returns_empty`: the transport sleeps 3s, `budget_s=0.2`, the call returns within 0.5s, and every query maps to `[]`.
  - `test_cache_hits_second_call`: a second call for the same query makes no HTTP request (count the transport calls).
  - `test_assign_distinct_and_alert_borrows_place`: two devs share a query. They get different files. An alert sharing a source URL with dev 0 gets a third, distinct file. An alert sharing no source gets `None`. A dev with an outlet `image_url` is skipped.
  - `test_request_has_user_agent`: the request headers include `USER_AGENT` from `backend/ingestion/common.py`.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest backend/tests/test_commons.py -v`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  - The query is the MediaWiki API at `https://commons.wikimedia.org/w/api.php` with these params: `action=query, format=json, generator=search, gsrsearch=<query> filetype:bitmap, gsrnamespace=6, gsrlimit=8, prop=imageinfo, iiprop=url|extmetadata|mime|size, iiurlwidth=800`.
  - Keep `mime` in {image/jpeg, image/png, image/webp} and require width ≥ 640.
  - Apply a denylist regex on the title: `flag|map|coat of arms|coat_of_arms|logo|diagram|locator|seal|emblem|chart`, case-insensitive.
  - Strip HTML from `Artist`.
  - Cache module-level as `dict[str, tuple[float, list[CommonsImage]]]` with a 24h TTL, and cap concurrency with `asyncio.Semaphore(4)`.
  - Wrap the whole fetch in `asyncio.wait_for(..., budget_s)`, and keep partial results gathered so far. Log failures at INFO. Never raise.
- [ ] **Step 4: Run** the same command. Expected: PASS. Then run `.venv/bin/python -m pytest backend/tests -q`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(backend): Wikimedia Commons file-photo lookup`

---

### Task 2: Wire Commons into synthesis (backend)

**Files:**
- Modify: `backend/synthesis/briefing.py:452-468` (`synthesize_briefing`)
- Test: `backend/tests/test_synthesis.py`

**Interfaces:**
- Consumes: `fetch_candidates`, `assign_images`, `query_for` (Task 1).
- Produces: `Briefing.key_developments[].commons_image` and `Briefing.priority_alerts[].commons_image`, both optional, in the API response and in the in-memory briefing cache.

- [ ] **Step 1: Write failing tests**
  - `test_commons_runs_alongside_context`: patch `enrich_with_historical_context` to sleep 0.3s and `fetch_candidates` to sleep 0.3s. The developments step must finish in under 0.5s, which proves the two overlap.
  - `test_commons_disabled_flag`: with `commons_images_enabled=False`, `fetch_candidates` is never called.
  - `test_commons_failure_does_not_fail_briefing`: when `fetch_candidates` raises, the briefing still returns with `commons_image=None` everywhere.
  - Use the existing synthesis test fixtures and mocks in that file.
- [ ] **Step 2: Run** `.venv/bin/python -m pytest backend/tests/test_synthesis.py -v`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - Inside `developments()`, after `_write_section`, `asyncio.gather` the existing `enrich_with_historical_context(partial)` with `fetch_candidates(unique non-None query_for(d) for d in partial.key_developments without an outlet image)`. Use an `httpx.AsyncClient` with the `USER_AGENT` header, and skip the fetch when the flag is off.
  - After the outer gather, call `assign_images(briefing, candidates)` inside a `try/except Exception`, logging any failure.
  - The `_fallback_briefing` (DEMO_MODE) path skips Commons.
- [ ] **Step 4: Run** `.venv/bin/python -m pytest backend/tests -q`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(backend): attach Commons file photos to developments and alerts`

---

### Task 3: Frontend image model and resolver

**Files:**
- Modify: `frontend/src/lib/types.ts` (`CommonsImage`, an optional `commons_image` on the API development and alert types)
- Modify: `frontend/src/lib/normalize.ts` (adds `commonsImage: CommonsImage | null` to `ViewDevelopment` and `ViewAlert`; both the API path and the saved-entry path accept missing values)
- Create: `frontend/src/lib/cardImage.ts`
- Test: `frontend/src/lib/cardImage.test.ts`, `frontend/src/lib/normalize.test.ts`

**Interfaces:**
- Produces: `interface CardImage { src: string; credit: string; href: string | null; filePhoto: boolean }`
- Produces: `function cardImage(sources: SourceCitation[], commons: CommonsImage | null): CardImage | null`. It prefers the first source with `image_url`, returning `credit: 'Photo: ' + (image_outlet ?? outlet)`, `href: source.url` and `filePhoto: false`. Otherwise it uses commons, returning `credit: 'File photo: {author}, {license}, Wikimedia Commons'`, `href: page_url` and `filePhoto: true`. Otherwise it returns `null`.

- [ ] **Step 1: Write failing tests:**
  - `prefers outlet image with outlet credit`
  - `falls back to commons with file-photo credit` (exact string `File photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons`)
  - `returns null with neither`
  - `uses image_outlet over outlet when present`
  - `normalizes legacy saved briefing without image fields` (a saved entry with no `commonsImage` key gives `commonsImage === null`, with no throw)
- [ ] **Step 2: Run** `npx vitest run src/lib/cardImage.test.ts src/lib/normalize.test.ts` (from `frontend/`). Expected: FAIL.
- [ ] **Step 3: Implement** the types, the normalize fields and `cardImage`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(story): card image model with outlet and file-photo credits`

---

### Task 4: Tension index model

**Files:**
- Create: `frontend/src/lib/tensionIndex.ts`
- Test: `frontend/src/lib/tensionIndex.test.ts`

**Interfaces:**
- Consumes: `linkBriefing` and `TimelineEntry` (`lib/timeline.ts`), and `buildRoutes`, `RouteColor` (`lib/routes.ts`).
- Produces:
  ```ts
  interface IndexItem {
    key: string                       // 'tension-0' | 'contradiction-2', same keys as LinkRef
    kind: 'tension' | 'contradiction'
    sides: string                     // tension: actors (already a string in ViewTension); contradiction: topic
    why: string                       // tension: description; contradiction: `${account_a} / ${account_b}`
    devs: number[]                    // linked development indexes
    color: RouteColor | null          // route colour when it holds a lane, else null
  }
  function buildTensionIndex(b, order: TimelineEntry[]): IndexItem[]   // sorted: most devs first, ties tension before contradiction, then source index
  function connectionLabel(items: IndexItem[], devIndex: number): string | null
  // e.g. "2 tensions", "1 tension · 1 contradiction", null when none
  ```
- [ ] **Step 1: Write failing tests:**
  - `sorts by link count then kind then index`
  - `contradiction why joins both accounts`
  - `colour only for lane holders`: with more than 5 tensions, the items beyond `MAX_LANES` have `color === null`
  - `keeps unmatched items with empty devs`
  - `empty briefing yields no index items`
  - `connectionLabel pluralises and joins`: covers `'1 tension'`, `'2 tensions'`, `'1 tension · 1 contradiction'` and `null`
- [ ] **Step 2: Run** `npx vitest run src/lib/tensionIndex.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Reuse `buildRoutes(b, order).colorFor`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(story): tension index model`

---

### Task 5: Tension index component and highlight state

**Files:**
- Create: `frontend/src/components/briefing/TensionIndex.tsx`, `frontend/src/state/useIndexHighlight.ts`
- Modify: `frontend/src/components/briefing/story.css` (index styles)
- Delete/replace: `frontend/src/state/useRouteHighlight.ts`. Move its remaining callers to `useIndexHighlight`.
- Test: `frontend/src/components/briefing/TensionIndex.test.tsx`, `frontend/src/state/useIndexHighlight.test.ts`

**Interfaces:**
- Consumes: `IndexItem` (Task 4).
- Produces:
  - `useIndexHighlight(): { pinned: string | null; previewed: string | null; active: string | null; pin(key: string): void; preview(key: string | null): void; clear(): void }`.
    - `active` is `previewed ?? pinned`.
    - `pin` toggles: pinning the same key unpins it.
  - `<TensionIndex items={IndexItem[]} devCount={number} order={number[]} highlight={…} />`. The heading reads `Tensions · {items.length}`.
    - It shows the top 3 items plus a `Show {n} more` button.
    - Each row is a `<button>`, so it can take focus. `aria-pressed` reflects the pin.
    - The strip has one square per development in `order`, filled when `devs` includes it.
    - The why line is clamped to 2 lines and has a `more`/`less` toggle.
    - Pressing Escape on the document calls `clear()`.
- [ ] **Step 1: Write failing tests:**
  - `renders top 3 and reveals the rest`
  - `hover previews and leave reverts to pinned`
  - `click pins, second click unpins`
  - `Escape clears pin`
  - `strip fills linked developments in order`
  - `contradiction row shows "Contradiction" and hot marker class`
- [ ] **Step 2: Run** `npx vitest run src/components/briefing/TensionIndex.test.tsx src/state/useIndexHighlight.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the component, the hook and the CSS.
  - Rows: hairline borders and square corners. The hover/active wash is `--accent-wash`.
  - The kind square uses the route colour, or `--hot` for contradictions, or `--ink-3` when there's no colour.
  - The strip squares are 10px: a `--rule-strong` outline when empty, `--ink` when filled, `--accent` when the row is active.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(story): tension index with preview and pin`

---

### Task 6: Timeline remodel and development card reshape

**Files:**
- Modify: `frontend/src/components/briefing/Timeline.tsx` (remove lanes; newest first)
- Modify: `frontend/src/components/briefing/DevelopmentCard.tsx` (image, time, one connection tag, highlight state)
- Create: `frontend/src/components/briefing/CardImage.tsx`
- Delete: `frontend/src/components/briefing/RouteKey.tsx`, `LinkedTabs.tsx`, `LinkedCards.tsx`, and their tests and CSS (`story.css` route-lane, `.route-*`, `.dev-tab*` and `.link-card*` rules), plus `lib/timelineGeometry` if only lanes used it. Check for other users first.
- Test: `Timeline.test.tsx`, `DevelopmentCard.test.tsx`, `CardImage.test.tsx`, `src/identity.test.ts`

**Interfaces:**
- Consumes: `cardImage` (Task 3), `connectionLabel` and `IndexItem` (Task 4), and `useIndexHighlight`'s `active`/`pin` (Task 5).
- Produces:
  - `<CardImage image={CardImage | null} variant="side" | "top" />`.
    - It renders nothing for `null`.
    - The `<img>` uses `loading="lazy"`, `decoding="async"` and `alt=""`.
    - `onError` hides the image and its credit.
    - When `filePhoto` is true, a `File photo` label sits over the image corner.
    - The credit line is an `<a>` to `href` with `target="_blank" rel="noopener noreferrer"` when `href` exists.
  - `<Timeline … onCardHover(devIndex | null) onCardFocus(devIndex | null) onTagTap(devIndex) />` (consumed by Task 7).
  - `DevelopmentCard` gets these classes:
    - `is-lit` when the active item links to it
    - `is-dim` when an item is active but doesn't link to it
  - Its connection tag button calls `onTag()`. In `Timeline`, `onTag` scrolls the index into view (`#tension-index`) and pins the first linked item.
- [ ] **Step 1: Write failing tests:**
  - `orders newest first, untimed last`
  - `card shows at most one connection tag with label`
  - `tag click pins first linked item`
  - `lit and dim classes follow active item`
  - `CardImage hides on error`
  - `CardImage shows File photo label only for commons`
  - In identity.test.ts, `no lanes, route key or linked tabs remain`: no source file imports `RouteKey`, `LinkedTabs` or `LinkedCards`, and story.css has no `.route-lane` or `.dev-tab`.
- [ ] **Step 2: Run** `npx vitest run src/components/briefing src/identity.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The card layout is a grid: an image column of 160px (aspect ~16:11) followed by `minmax(0, 1fr)`. At ≤ 640px the image moves to the top at 16:9.
  - Keep `grid-template-columns: minmax(0, 1fr)` discipline on inner grids. This guards against the earlier overflow bug.
  - "From the archive" stays unchanged.
- [ ] **Step 4: Run** `npx vitest run && npm run build && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(story): newest-first timeline with images and a single connection tag`

---

### Task 7: Globe follows the reader

**Files:**
- Create: `frontend/src/globe/follow.ts` (a pure state machine)
- Modify: `frontend/src/globe/engine.ts` (gliding between zoomed targets, framing several points, single-marker emphasis)
- Modify: `frontend/src/globe/GlobeView.tsx`, `frontend/src/globe/Globe.tsx` (the new `follow` prop)
- Test: `frontend/src/globe/follow.test.ts`

**Interfaces:**
- Consumes: the `Timeline` hover/focus/tap callbacks (Task 6), `useIndexHighlight().active/pinned` and `IndexItem.devs` (Task 5), and the region resolution from `globe/regions.ts` (`resolveRegion` for a development's `place` or first region).
- Produces:
  ```ts
  type FollowTarget = { points: { lat: number; lng: number }[]; markerKey: string | null } | null
  interface FollowInput { hoveredDev: number | null; focusedDev: number | null; tappedDev: number | null;
    previewItem: string | null; pinnedItem: string | null; carouselOpen: boolean; touch: boolean }
  function createFollow(opts: { resolve: (dev: number) => { lat: number; lng: number; markerKey: string } | null;
    itemDevs: (key: string) => number[]; dwellMs?: number /* 250 */; leaveMs?: number /* 400 */;
    onTarget: (t: FollowTarget) => void }): { update(input: FollowInput): void; dispose(): void }
  ```
  - `GlobeView` prop: `follow?: FollowTarget`. With one point, the globe zooms to it and emphasises `markerKey`. With several, it frames them, or falls back to the overview when the spread is over ~120° of longitude. With `null`, it zooms out. Under reduced motion, the change is instant.
- Precedence, from the spec, in priority order:
  1. While `carouselOpen`, no targets are emitted.
  2. A card hovered or focused for ≥ dwell targets that development. Dwell doesn't apply to keyboard focus or touch tap.
  3. Otherwise a previewed item targets its developments' points.
  4. Otherwise a pinned item does the same.
  5. Otherwise, after `leaveMs`, the target is `null`.
  - A development that can't be resolved leaves the current target unchanged.
  - In `touch` mode, hover is ignored and only `tappedDev` counts.
- [ ] **Step 1: Write failing tests** (vitest fake timers):
  - `sweep under 250ms never emits a target`
  - `dwell 250ms emits that development`
  - `moving card to card glides without null in between`
  - `leaving emits null after 400ms`
  - `pinned item frames its developments when nothing hovered`
  - `carousel open suppresses targets`
  - `unresolvable development leaves target unchanged`
  - `touch mode ignores hover and follows tap`
  - `focus emits immediately`
- [ ] **Step 2: Run** `npx vitest run src/globe/follow.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `follow.ts`. Then add the engine support, choosing the API. The existing `zoomTo`/`focusOn` may already ease between targets; if so, reuse them. Wire the `follow` prop.
- [ ] **Step 4: Run** `npx vitest run && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(globe): follow the hovered development`

---

### Task 8: Story tab layout, Read first strip, and verification

**Files:**
- Modify: `frontend/src/routes/StoryTab.tsx` (the new order, wiring Tasks 4–7, and `touch` from `matchMedia('(hover: none)')`)
- Modify: `frontend/src/components/briefing/AlertCallout.tsx` (Read first cells with `CardImage variant="top"`, the rationale clamped to 2 lines, 3 shown plus `Show {n} more`, and omitted entirely when there are no alerts, which means removing the "No priority alerts" note)
- Modify: `frontend/src/components/briefing/story.css`, `frontend/src/routes/briefing-layout.css` as needed
- Modify: `CLAUDE.md` (Architecture: one line on the Story tab structure and `backend/synthesis/commons.py`)
- Test: `frontend/src/routes/StoryTab.test.tsx` (create it if absent; mock `Globe` as the existing tests do), and `AlertCallout` tests

**Interfaces:**
- Consumes: everything above.
- Produces: the final page.
  - Order: Read first (only if there are alerts), then `section#key-developments` containing a left column (`#tension-index` and the timeline) and a right column (a sticky globe at ≥ 980px, `top: var(--space-5)`), then TopStories (always), then ReadingList.
  - Below 980px, the globe moves above the left column and isn't sticky.
  - Globe arcs: pass `litArcs = new Set(active ? [active] : [])` from `useIndexHighlight`. This replaces the old `highlight.lit`. Keep `onArcHover`, mapped to `preview`.
- [ ] **Step 1: Write failing tests:**
  - `renders sections in order: read first, key developments, top stories, reading list`
  - `omits read first when no alerts`
  - `read first shows 3 and reveals more`
  - `index omitted when no tensions or contradictions`
- [ ] **Step 2: Run** `npx vitest run src/routes/StoryTab.test.tsx src/components/briefing`. Expected: FAIL.
- [ ] **Step 3: Implement** the layout, the CSS and the CLAUDE.md line.
- [ ] **Step 4: Verify.**
  - Run `npx vitest run && npm run build && npm run lint` and `.venv/bin/python -m pytest backend/tests -q`. Expected: all pass.
  - Visual check: run the backend (`.venv/bin/python -m uvicorn backend.main:app --port 8000`) and `npm run dev`. Generate one busy briefing (a focus with 6+ tensions, e.g. "Israel Iran"), and load one pre-change saved briefing seeded into localStorage.
  - Screenshot each at 1280 and 375. Confirm:
    - the index works with no lanes or tab stacks
    - the sticky globe follows card hover calmly
    - images and credits appear, with "File photo" on Commons images
    - `scrollWidth` ≤ 375
- [ ] **Step 5: Commit** `feat(story): read first strip and timeline-first layout`
