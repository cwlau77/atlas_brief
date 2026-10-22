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

### ~~Archive: select, delete and star in bulk~~ (done 2026-10-19)
Add a select mode to the Archive (`routes/ArchivePage.tsx`): a "Select" toggle that puts a checkbox on each briefing, plus "Select all" per topic thread. A toolbar acting on the selection offers **Delete** and **Star / Unstar**. Today each briefing can only be starred or deleted one at a time through its bead actions. Keep spec 2's rules: real buttons and checkboxes with names, no `window.confirm` (use `ConfirmDialog`, saying how many will be deleted), one failure toast if the storage write fails, and starred briefings are never dropped silently. Owner request, 2026-10-19.

### Card photos: fall back to Commons when the outlet photo fails
When an outlet's photo fails to load, `CardImage` hides the picture, and the card shows no photo at all. The backend only looks up a Commons "File photo" (`synthesis/commons.py`) for developments that have no outlet image, so there's nothing to fall back to. Proposed fix:
- **Backend:** look up a Commons candidate for every development, inside the existing 1.5s budget and 24h cache. That's up to about six extra Wikimedia requests per briefing on a cold cache.
- **Frontend:** `lib/cardImage.ts` returns the Commons photo as a fallback, and `CardImage` swaps to it on error.

Estimate: about an hour. Raised by the 2026-10-21 briefing-polish review; the owner deferred it on 2026-10-22.

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

