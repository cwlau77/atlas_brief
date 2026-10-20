# Briefing page: timeline first, tension index, globe that follows, imagery. Design spec

**Date:** 2026-10-20
**Status:** Implemented on branch story/briefing-page.
**Implementation deviations:**
- Development cards that the highlighted row doesn't touch are not faded with opacity, unlike the ~30% in §5.1 (any whole-card opacity took text below WCAG AA). Only the picture (40% opacity, greyscale), the priority square, the chips and the card rule recede, and the text drops to `--ink-3`, which keeps 4.5:1 on paper.
- Previewing an index row (hover) also waits for the 250ms dwell before the globe moves, like card hover (§6), so sweeping across the index doesn't lurch the globe.
- Only keyboard focus holds the globe on a card. The code uses a heuristic, not `:focus-visible`: focus that arrives within 300ms of a pointer press on the card counts as a click and does not hold the globe. Focus moved onto the card itself (jumping to a story) still counts.
- The Commons lookup (§7) tries the place's own English Wikipedia lead image first (`prop=pageimages`, then Commons `imageinfo` for that file, with the same filters). A Commons search biased with `skyline OR cityscape OR panorama OR street` comes after it. The plain top search hit was often unrelated to the place, such as a church-dome mosaic on a war alert. The denylist matches whole words, and files whose author credit is longer than 120 characters are skipped.
- On touch devices, a region-tag tap is a one-off request. It expires when a row is pinned or previewed, or when a carousel opens, so the latest intent wins.
- The outside-click unpin listener uses `click`, not `pointerdown`, so a touch scroll that starts outside the index keeps the pin.
**Roadmap:** project 2 of 4 from the 2026-10-20 design review (see `2026-10-20-newsprint-identity-design.md` §0). Project 1 (Newsprint & Ultramarine identity) has shipped to local `main`. All styling here uses its tokens and rules.
**Exploration board:** visual companion `.superpowers/brainstorm/15508-1792520807/content/kd-directions.html`, direction A.

## 1. Intent

A briefing's Story tab should orient a reader fast. The owner says readers look first for **the most recent developments, the tensions, and context**. The owner's friend, a reviewer, called the timeline "the most useful thing for me… really important to orient myself" and asked for it to move to the front. They also asked for the globe to "zoom into a detail view of whatever region is being detailed", and for imagery in briefings ("imagery always very important").

Today Key developments falls apart on busy stories. The connection lanes beside the timeline become "really cluttered and distracting", and the stacked tension tabs inside each card make the column far too long. **This project remodels Key developments** and reorders the Story tab around it.

Connections between developments must answer exactly two questions: **which developments are connected, and why they conflict.**

The audience is anyone who follows world events seriously. Georgetown think-tank writers are one important stakeholder group.

## 2. Goals, non-goals, anti-goals

**Goals**
- A compact Read first strip of priority alerts at the top (§4).
- Key developments as the main section: a tension index above a clean timeline, with the globe beside it (§4–5).
- The globe follows the reader. Hovering a development zooms to its place (§6).
- Images on alert cells and development cards, from outlet lead images and Wikimedia Commons (§7).

**Non-goals**
- The Signals tab, the Archive, the home page, the hotspots tab (project 4), and the loading screen (project 3).
- Changing what the synthesis LLM produces. The tensions, contradictions, developments and their fields stay as they are, except for the new image fields in §7.
- Dark mode.

**Anti-goals (a failure even if it technically works)**
- Clutter returning: lanes, stacked tabs, or more than one connection tag per card.
- A globe that lurches as the pointer sweeps across cards.
- Grey placeholder boxes where no image exists.
- Images without a credit line, or Commons images without author and licence.
- Losing "From the archive" context. The reviewer loves it.
- Rebuilding instead of reshaping. The owner's standing rule is to reuse the existing components (`Globe`, `StoryCarousel`, `TopStories`, `ReadingList`, `PriorityMark`, `SourceChips`, `DevelopmentCard`) and change them only where this spec asks.

## 3. Constraints

- Frontend: Vite + React 19 + TS, plain CSS, custom three.js globe (`globe/engine.ts`). Tokens live only in `styles/tokens.css`.
- All motion respects `prefers-reduced-motion`. That setting only affects users who turned it on in their OS. Everyone else gets the full animation.
- The backend must stay a single long-running process (CLAUDE.md). Caches are in-memory.
- A failing image lookup must never fail or noticeably slow a briefing.
- Briefings already saved in localStorage have no new image fields and must still render. Their cards fall back to outlet images or no image.
- Phone width: 16px gutter, no horizontal scroll at 375px.
- WCAG AA contrast. Interactive rows and cards are keyboard-operable.

## 4. Page order (Story tab)

From top to bottom:
1. **Masthead.** Title, issued time, Story and Signals tabs. Unchanged.
2. **Read first.** Shown only when the briefing has alerts. Each alert is a ruled cell containing:
   - an image (§7)
   - the severity square (`PriorityMark`)
   - the headline
   - the rationale, clamped to 2 lines
   - `SourceChips`

   Cells sit 3 across on desktop, 2 on tablet and 1 on phones. If there are more than 3 alerts, the first 3 show and a "Show N more" control reveals the rest. *(My call.)*
3. **Key developments.** The main section, a two-column region:
   - **Left column (wider):** the tension index (§5.1), then the timeline (§5.2).
   - **Right column:** the globe, `position: sticky` so it stays in view while the timeline scrolls. The existing story carousel still opens over it when a globe point is clicked.
   - Below 980px the globe sits above the left column and is not sticky.
4. **Top stories.** Always below Key developments now. Today it fills the lead column when a briefing has no alerts, and that special case goes away.
5. **Reading list.** Unchanged.

The current `story-lead` layout (alerts or top stories beside the globe) is replaced by items 2–3.

## 5. Key developments

### 5.1 Tension index (direction A)

A ruled list headed "Tensions · N". **Contradictions join the same list** *(my call; the owner approved the playback)*. Each row holds:
- **Kind marker.** Tensions use the route colour square that matches their globe arc (`ROUTE_COLORS` via `buildRoutes`). Contradictions use a `--hot` square plus the word "Contradiction". Items with no globe route (beyond `MAX_LANES`) use a neutral `--ink-3` square.
- **Sides.** For a tension, its `actors` joined with " ↔ ". For a contradiction, its `topic`. Shown in 600 weight.
- **Why.** For a tension, its `description`. For a contradiction, "A says… / B says…" condensed from `account_a` and `account_b`. Clamped to 2 lines, with a "more" toggle on the row.
- **Development strip.** One small square per development, in timeline order. Squares for developments this item links to are filled. The links come from the existing `linkBriefing` region matching in `lib/timeline.ts`, unchanged.

Behaviour:
- **Highlight.** Hovering a row, or focusing it with the keyboard, highlights its linked development cards with an accent wash and fades the others to about 30% opacity. On the globe, its arc is lit and the other arcs are dimmed.
- **Pin.** Clicking or pressing Enter pins the highlight. Clicking the same row, pressing Escape or clicking elsewhere unpins it. One row is pinned at a time.
- **Length.** The index shows the 3 items with the most links (ties: tensions before contradictions, then source order). "Show N more" expands the rest. *(My call.)*
- **No linked developments.** Items with no linked developments still appear, with an empty strip. This keeps today's rule: "anything unmatched is shown separately, never attached at random."
- **Empty briefing.** If a briefing has no tensions or contradictions, the index is omitted.

### 5.2 Timeline

- **Order: newest first.** The owner looks for "the most recent developments", so this reverses today's ascending `sortDevelopments` for display. Developments with no time go last.
- **Each card reshapes `DevelopmentCard`:**
  - image (§7)
  - `PriorityMark`
  - time
  - region tags
  - headline
  - summary
  - "From the archive" context, unchanged
  - `SourceChips`
  - at most **one connection tag**, for example "2 tensions" or "1 tension · 1 contradiction"
- **Connection tag.** Clicking it scrolls the index into view and pins the first linked item. *(My call.)*
- **Removed:** the route lanes beside the timeline (`Timeline.tsx` lane drawing and the related `story.css` route-lane rules), the `RouteKey` legend, and the per-card `LinkedTabs` and `LinkedCards`. Delete the code that is no longer used.
- **Kept:** `lib/routes.ts` still assigns arc colours for the globe and the index squares.

## 6. Globe follows the reader

- **Hover to zoom.** Hovering a development card, or focusing it with the keyboard, for **250ms** eases the globe to that development's location: `dev.place` if present, otherwise its first resolvable region centroid (as in `globe/regions.ts`). That place's marker is lit and the other markers are dimmed.
- **Between cards.** Moving to another card glides straight there without zooming out.
- **Leaving.** When the pointer or focus leaves the timeline for 400ms, the globe eases back to its overview. *(My call.)*
- **Hovering a tension row.** This lights that row's arc and frames both ends: zoom out just enough to fit them, or keep the overview if they're far apart. *(Builder may judge the framing.)*
- **Rows with no arc:** contradictions, and tensions beyond `MAX_LANES`. These highlight their linked developments' markers and frame those places the same way. *(My call.)*
- **Precedence** between competing gestures *(my call)*:
  - **Card highlight:** a pinned index row owns it. Hovering another row previews that row's highlight, and leaving the row reverts to the pinned one.
  - **Globe zoom:** follows card hover even while a row is pinned.
  - **Story carousel open** (from a globe click): hover-follow and row-driven globe moves pause, and resume when it closes.
  - **Nothing hovered, a row pinned:** the globe frames the pinned row.
- **No location.** A development with no resolvable place leaves the globe where it is.
- **Clicking a globe point** keeps today's behaviour: zoom in and open the place's `StoryCarousel`. Hover-follow pauses while the carousel is open.
- **Touch devices (no hover).** Tapping a card's region tag or place name zooms the globe. Hover-follow is off on touch-primary devices (`(hover: none)`).
- **Reduced motion.** The globe moves instantly, with no easing. Everyone else gets the full motion.
- **Engine support.** The engine already has `zoomTo` and `zoomOut`. Add only what's needed for gliding from one zoomed target to another and for highlighting a single marker. The builder chooses the engine API.

## 7. Imagery

**Where:**
- Read first cells: an image on top.
- Development cards: on desktop, a fixed-ratio crop of about 160×110 on the left of the card, with the text to its right; on phones, a full-width 16:9 image on top.
- Top stories keep their existing images.

**Source order per card:**
1. **Outlet lead image.** Use the first `sources[].image_url` that exists. Credit: "Photo: {image_outlet ?? outlet}". The data already carries this.
2. **Wikimedia Commons photo**, looked up by the backend (below). These photos show the *place*, not the event, so each one carries a small **"File photo"** label over the image corner. The owner left this to me and I chose to keep it honest for analysts. Credit: "File photo: {author}, {licence short name}, Wikimedia Commons". It links to the file's Commons page and opens in a new tab.
3. **None.** The card renders text-only with no placeholder.

**Display:**
- Images use `loading="lazy"` and `decoding="async"`, with `alt=""` because they are decorative; the headline carries the meaning.
- An image that fails to load hides itself and its credit.
- The credit is small `--ink-3` text under or over the image, readable at AA.

**Backend Commons lookup (new):**
- **Where:** a new module in `backend/synthesis/` (or wherever fits the pipeline), called once per briefing after synthesis.
- **What it fills:** for each key development and priority alert that has no outlet image, an optional `image` object `{ url, page_url, author, license, source: "commons" }`.
  - Add this as an optional `CommonsImage` field on `KeyDevelopment` and `PriorityAlert` in `models.py`, and extend the TS types and `normalize.ts`.
- **Query:** the development's `place.name`, falling back to its first region.
- **Alerts:** `PriorityAlert` has no place, so an alert borrows the place of the first key development that shares one of its source URLs. With no such development, the alert gets no Commons image; it still gets its outlet image if one exists. Never query by the briefing focus string, because results are poor. *(My call.)*
- **API:** the MediaWiki API on commons.wikimedia.org, `generator=search` in namespace 6 (files) plus `prop=imageinfo` with `iiprop=url|extmetadata` and a thumbnail width of about 800px. Send a descriptive `User-Agent`, as Wikimedia requires; the backend already has a UA convention.
- **Filtering:**
  - Keep only bitmap photos (JPEG, or PNG/WebP with photo-like dimensions) at least 640px wide.
  - Exclude maps, flags, coats of arms, logos, diagrams and SVGs, using a filename/category keyword denylist plus the MIME check.
  - Require `extmetadata.LicenseShortName` and an author (`Artist`, HTML stripped). Skip files missing either.
- **Deduplication:** no Commons file repeats within one briefing.
- **Performance and failure:**
  - **Placement:** the lookup runs inline in `POST /briefing`, concurrently with the per-development historical-context step (`synthesis/context.py`), so it overlaps existing work instead of adding to it. *(My call.)*
  - **Budget:** a hard total of **1.5s** from when the lookup starts. Lookups run concurrently within that budget.
  - **Caching:** the in-memory briefing cache stores the briefing *with* its Commons images. Briefings saved before this change simply have none.
  - Any timeout or error means no image for that card. It is logged, never raised.
  - An in-memory cache keyed by query string with about a 24h TTL means the same place isn't fetched twice. This follows the single-process assumption.
  - Respect a reasonable concurrency cap.
- **Config:** add an enable flag to `config.py` (default on) and `.env.example`. No API key is needed.
- **Tests:** follow the existing patterns in `backend/tests`, mocking HTTP. Cover the filter rules, licence and author extraction, deduplication, budget and timeout behaviour, and the cache.

## 8. Backward compatibility

- Saved briefings without `image` fields render with outlet images or no image.
- Saved briefings with only ascending-ordered data still display newest-first, because sorting happens at render time.

## 9. Tests and verification

**Frontend tests:**
- Index row content (sides, why, strip).
- Highlight and pin behaviour, including keyboard and Escape.
- "Show N more".
- Newest-first ordering.
- A single connection tag per card.
- Image source fallback order and the credit text.
- A broken image hides itself.
- A source-scan check that lanes, `RouteKey` and `LinkedTabs` are gone.

**Globe tests:** extract the hover-delay and target-resolution logic into a pure, testable module, and unit-test the 250ms and 400ms timers with fake timers.

**Visual check:** with a real busy briefing (6 or more tensions or contradictions) at 1280 and 375. Confirm:
- no clutter
- the sticky globe
- hover-follow feels calm
- images and credits render
- no horizontal scroll

Also do one check with a saved, pre-change briefing.

**Commands:** `npm run build`, `npm run lint`, `npx vitest run`, and `.venv/bin/python -m pytest backend/tests`.

## 10. Left to the builder

- Exact image crop ratios and sizes.
- The engine API for gliding and single-marker highlight.
- Arc framing when a tension row is hovered.
- The Commons denylist details.
- Breakpoint tuning for the Read first grid.
