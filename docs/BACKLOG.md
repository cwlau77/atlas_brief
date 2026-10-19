# Atlas backlog

Ideas captured for later. Each needs its own design pass (brainstorm → spec → plan) before work starts. The longer product backlog (Kano-ranked: watchlist and deltas, time-budget path, framing compass, shareable links, and more) is in `docs/archive/HANDOFF-code-review-and-backlog-2026-10-17.txt`, Part B. Shipped implementation plans are in `docs/archive/plans/`.

## 0. Next up

### ~~Repo cleanup and code review~~ (done 2026-10-18)
Thermo-nuclear review pass. Shipped: one Claude call helper (`backend/llm.py`) for planning, rerank, synthesis and context; a shared `make_article` for all 13 sources; a single pipeline log line in `main.py`; dead code removed (unused embedding helpers and setting, redundant URL dedupe, unused icons and helpers); `AppState` persistence moved out of state updaters (fixes a delete-failure toast that never fired); shipped plans archived. Deferred findings are under §5.

### ~~Rebrand to "Atlas"~~ (done 2026-10-18, celadon palette 2026-10-19)
Shipped in the brand identity spec; the palette moved from moss to celadon in UI spec 2.

### ~~Clear way back to Home~~ (done 2026-10-19)
A "New brief" button in the nav on every page (UI spec 2).

### UI spec 3: story timeline tuning, globe arcs, click-to-zoom, story carousel, article images
The third part of the UI vision (see `docs/superpowers/specs/2026-10-18-atlas-brand-identity-design.md` and `2026-10-19-ui-layout-polish-design.md`). Not yet designed. The globe item below is part of it.

### Globe: connecting arcs and named places
Two gaps compared with the redesign mockup:
- **Arcs.** Draw lines between related points on the briefing globe. Candidate relation: two regions share a development, tension or contradiction (`linkBriefing` already computes these links for the timeline).
- **Named places.** Points are country or region centroids today: `globe/regions.ts` resolves `regionCounts` names through `lib/centroids`. Showing specific places (e.g. "Bab el-Mandeb", "Ashburn, Virginia") needs the synthesis prompt and the `Briefing` model to emit named locations with coordinates, plus a check that the coordinates are plausible. This is a backend change, not just a globe change.

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

