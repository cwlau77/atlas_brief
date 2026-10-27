# Atlas backlog

Ideas captured for later. Each needs its own design pass (brainstorm → spec → plan) before work starts. The longer product backlog (Kano-ranked: watchlist and deltas, time-budget path, framing compass, shareable links, and more) is in `docs/archive/HANDOFF-code-review-and-backlog-2026-10-17.txt`, Part B. Shipped implementation plans are in `docs/archive/plans/`.

## 0. Next up

### ~~Repo cleanup and code review~~ (done 2026-10-18)
Thermo-nuclear review pass. Shipped: one Claude call helper (`backend/llm.py`) for planning, rerank, synthesis and context; a shared `make_article` for all 13 sources; a single pipeline log line in `main.py`; dead code removed (unused embedding helpers and setting, redundant URL dedupe, unused icons and helpers); `AppState` persistence moved out of state updaters (fixes a delete-failure toast that never fired); shipped plans archived. Deferred findings are under §5.

### ~~Rebrand to "Atlas"~~ (done 2026-10-18, celadon palette 2026-10-19)
Shipped in the brand identity spec; the palette moved from moss to celadon in UI spec 2.

### ~~Clear way back to Home~~ (done 2026-10-19)
A "New brief" button in the nav on every page (UI spec 2).

### ~~UI spec 3: globe zoom and story carousel, top stories, routes, arcs, named cities, article images~~ (done 2026-10-19)
Shipped per `docs/superpowers/specs/2026-10-19-ui-spec-3-design.md`: article images from 8 sources, named cities resolved against a bundled GeoNames list, a Top stories photo strip, click-to-zoom with a centred carousel on briefing globes, and transit-style routes (key, colour-matched tabs, explain-on-hover) with matching globe arcs. This also covered the old "Globe: connecting arcs and named places" item.

### ~~Home: trending topics instead of fixed sample chips~~ (done 2026-10-19)
Shipped as `GET /trending` (`backend/trending.py`): Google News US top stories grouped by Haiku into up to 6 specific topics, cached an hour in process. Home shows them as "Trending now" chips and keeps the fixed chips when the backend is asleep, has no key, or fails. Original note:
Under the hero's ask box, replace the four fixed topic chips (`SUGGESTIONS` in `HomePage.tsx`) with a "Trending now" dropdown or strip of hot stories and areas, refreshed from live sources. Needs a design pass: where trending comes from (GDELT, Google News top stories or recent Atlas briefings), how often it refreshes, and a fallback when the backend is asleep. Owner request, 2026-10-19.

### ~~Home: the wire replaces the trending chips~~ (done 2026-10-22)
Shipped per `docs/superpowers/specs/2026-10-22-home-wire-design.md`: "On the wire" lists up to five newsroom topics with the time of their newest headline, in Newsprint hairline lines, and falls back to "Suggested" lines in the same style.

### ~~Archive: select, delete and star in bulk~~ (done 2026-10-19)
Add a select mode to the Archive (`routes/ArchivePage.tsx`): a "Select" toggle that puts a checkbox on each briefing, plus "Select all" per topic thread. A toolbar acting on the selection offers **Delete** and **Star / Unstar**. Today each briefing can only be starred or deleted one at a time through its bead actions. Keep spec 2's rules: real buttons and checkboxes with names, no `window.confirm` (use `ConfirmDialog`, saying how many will be deleted), one failure toast if the storage write fails, and starred briefings are never dropped silently. Owner request, 2026-10-19.

### ~~Card photos: fall back to Commons when the outlet photo fails~~ (done 2026-10-26)
Shipped, widened to "more cards show a photo", per `docs/superpowers/specs/2026-10-26-card-photos-design.md`: Tavily results carry their own photo, Commons keeps lead images when a search overruns (and backfills the cache), every development and alert gets a Commons fallback, and timeline, alert and Top-stories cards fall through outlet photos, then the file photo. Original note:
When an outlet's photo fails to load, `CardImage` hides the picture, and the card shows no photo at all. The backend only looks up a Commons "File photo" (`synthesis/commons.py`) for developments that have no outlet image, so there's nothing to fall back to. Proposed fix:
- **Backend:** look up a Commons candidate for every development, inside the existing 1.5s budget and 24h cache. That's up to about six extra Wikimedia requests per briefing on a cold cache.
- **Frontend:** `lib/cardImage.ts` returns the Commons photo as a fallback, and `CardImage` swaps to it on error.

Estimate: about an hour. Raised by the 2026-10-21 briefing-polish review; the owner deferred it on 2026-10-22.

### ~~Synthesis section calls time out~~ (done 2026-10-27)
In a live run on 2026-10-26 one Sonnet section call hung for the Anthropic SDK's default 600s, was retried by the SDK, and the briefing took over 10 minutes (`synthesis_ms=613427`). Each section call in `synthesis/briefing.py` now has a 45s timeout (`synthesis_section_timeout_seconds`) and one shared retry: a timeout or overload/5xx error gets one resend, a bad-JSON reply gets the corrective retry, whichever comes first; other API errors aren't retried. Worst case is about 90s per section. Failed developments still fail the briefing (now with a 502 that doesn't claim the reply was unreadable); signals and alerts are left empty.

### Story tab: timeline first, tensions below it
Owner request, 2026-10-27. Today the tension index sits above the timeline in `section#key-developments`, so readers hit the tensions before they know what happened. New order on the Story tab: Read first → timeline (with its sticky globe) → Trends & implications (below) → tension index → Top stories → reading list. The globe's follow behaviour (`globe/follow.ts`) and the index's hover/pin linking to cards must still work across the larger distance between index and timeline.

### Tension index: say what the relationship is
Owner feedback, 2026-10-27: at first glance the index rows are unclear.
- **The squares** (one per development, filled when linked) don't say which events a tension ties to. Name the linked developments instead (headline or date), or alongside.
- **The arrows between actors** don't say whether the actors are in conflict or involved in the same event. State the relationship in words (e.g. "in conflict", "competing claims", "same event, different accounts"). This probably needs synthesis to emit a relationship type per tension; today `Tension` has only `description`, `actors`, `sources` and `related_developments`.
- The owner wants both: the relationship in words and the linked developments named.

### Trends & implications section
Owner request, 2026-10-27. A new Story-tab section after the timeline, in two parts:
- **Trends:** patterns Atlas sees across the developments in this brief (e.g. repeated ceasefire breaches in one area).
- **Implications:** what it likely means next and what to watch.

Honesty rule (owner's): prefer analysis an article actually states, linked to that article. When no article says it, Atlas may give its own assessment, but must mark it clearly as Atlas's own prediction, not reported fact, and still point to the developments it reasons from. Needs a synthesis change (a new section call or field) and a design pass on how "sourced" and "Atlas assessment" look different.

### Key figures and charts on development cards, each figure sourced
Owner request, 2026-10-27. Analysts need to know which article a statistic came from. Each development card gets a **Key figures** list: the figure, what it measures, and a link to the article Atlas took it from. Where a card has comparable figures, show them as a chart or stat tiles; the owner rates visual data highly.
- Every figure must come from a cited article, never be computed or invented by the model, and keep its unit, date and outlet.
- Likely a model change (e.g. `KeyDevelopment.key_figures: [{value, label, source}]`) with the source validated against the article list, like `enforce_url_allowlist` does for citations.
- Open: how many figures per card, whether charts need several figures from the same source and period, and how saved briefings without figures render.

### Hotspots tab
Project 4 of the 2026-10-20 design-review roadmap (see `docs/superpowers/specs/2026-10-20-newsprint-identity-design.md`), the only one not started. A new top-level page with red/amber news-intensity markers on the globe, plus a flat-map view. Red and amber are reserved for heat, and the identity spec names "globe/hotspot heat markers" as one of their uses.
- **Builds on:** the globe engine's `setHotspots`, `setArcs`, `focusOn` and `zoomTo`; briefing globes already draw hotspot markers, but in one accent colour, because all markers share one shader (the identity spec deferred the ink / `--hot` split).
- **Main design question:** what "intensity" measures and where it comes from. `GET /trending` (Google News top stories grouped by Haiku) is one possible seed; GDELT volume or recent Atlas briefings are others.
- **Open:** the flat-map projection and library, how often it refreshes, and its fallback when the backend is asleep.

## 1. Ask Atlas about this briefing (chat)

A chat panel on the briefing page that answers questions about the current briefing: "Why does the Suez revenue drop matter?", "Which sources disagree about the tanker damage?", "What should I read first?"

- Grounded only in the briefing's content and its cited articles. Every answer cites its sources and says so when the briefing doesn't cover the question. It should not trigger a fresh search when the briefing is thin, because that would hide retrieval failures.
- Lives on the Briefing page (likely a third tab, or a side panel next to Story/Signals).
- Backend: a stateless endpoint that receives the briefing payload (briefings are stored client-side until §4 lands).
- Open questions: conversation memory per briefing, cost limits.

## 2. Onboarding and personas

A first-run flow that builds a user profile and tailors briefings to it.

- Captures role or persona (student, analyst, investor, policy staffer, journalist), regions and topics of interest, depth preference, and reading time.
- Persona shapes emphasis only (synthesis framing, jargon level, default topic chips). It must not change which facts or sources the reader sees.
- Extends the existing Settings/profile data (`userProfileV1`), or the Supabase profile once §4 lands.
- Open questions: skippable or required, editing later from Settings, per-briefing or global.

## 3. Retrieval follow-ups

Broaden retrieval shipped on 2026-10-17: query planning, 13 sources, URL dedupe, and Haiku rerank. See `docs/superpowers/specs/2026-10-17-broaden-retrieval-design.md`. Still open:

- **Done 2026-10-17:** GDELT fails fast on 429; finance mode only for market topics; empty-result hints name skipped sources; Home copy updated; briefing cites article numbers (synthesis was truncating on long Google News URLs).
- **Live check with real keys.** "Data centers and privacy in the US" should return 15 or more on-topic articles from at least 4 source types. Use the `briefing pipeline` log line to check the rerank fallback rate and latency.
- **Google News defaults to the US** (`google_news_source.py`: `plan.country or "US"`), which skews global topics. It also stores `news.google.com` wrapper URLs instead of the publisher URL, so the same Reuters story doesn't dedupe against Reuters from RSS.
- **Quota is spent before the request.** Timeouts and 429s still use up the daily budget.
- **Done 2026-10-18:** shared `make_article(...)` in `ingestion/common.py`. Still open: Guardian always tags `country="GB"`, even for non-UK stories.
- **Rerank reply size.** The rerank reply may often hit the 8 s timeout at 60 candidates. If the live check shows frequent fallbacks, ask for a compact reply format.
- **Coverage inspector.** Show article count, source mix and the time window used on Signals, so a thin brief can be explained from the UI.

## 4. Database (Supabase)

Move user state off `localStorage` into Supabase. Today the archive, profile and settings are browser-only, and the backend keeps quotas and the briefing cache in process memory, so a Render restart or spin-down resets them.

- **First tables:** briefings (the archive), user profile/settings, and optionally the per-source daily quota counters and the briefing cache.
- **Features it unlocks:** shareable read-only briefing links, watchlist and "what changed since the last brief", multi-device sync, and personas stored server-side.
- **Open questions:** auth (Supabase Auth, or anonymous plus magic link), migrating existing `localStorage` archives, and row-level security policies.

## 5. Code-review follow-ups (deferred from the 2026-10-18 review)

These change behavior or need a live check, so they weren't folded into the cleanup.

- **Two keyword systems.** `focus_terms` (curated aliases, distinctive tokens) drives the rerank fallback filter, while `SearchPlan.match_terms` drives the prefilter and RSS. The fallback re-filters the prefiltered candidates with a different vocabulary built from the same focus. Collapse to one: let `filter_by_relevance` take the plan instead of re-deriving terms from the phrase. Needs the live check in §3 first.
- **Legacy citation dicts in synthesis.** `_parse_citations` and `_parse_readings` still accept `{"outlet", "url"}` dicts from before article-number citations. A reading dict with a URL but no title raises `KeyError`, which burns a full synthesis retry. Delete the legacy branches; `enforce_url_allowlist` stays as the backstop.
- **Quota lookup by string.** `QuotaGuard.take` finds budgets with `getattr(settings, f"quota_{source}_per_day")`. A typo silently means unlimited. Use an explicit source-to-budget map.
- **The "frequency" selector does nothing.** Daily, twice-daily and weekly only label the saved briefing. Decide in the UI pass whether to remove it or make it real (needs scheduling).
- **Profile fields are unused.** Email and field of study are collected but never read. Fold into §2 onboarding or remove.

