# Atlas backlog

Ideas captured for later. Each needs its own design pass (brainstorm → spec → plan) before work starts. The longer product backlog (Kano-ranked: watchlist and deltas, time-budget path, framing compass, shareable links, and more) is in `docs/HANDOFF-code-review-and-backlog-2026-10-17.txt`, Part B.

## 0. Next up

### Repo cleanup and code review
A full code review and cleanup pass before new features: remove fluff and dead code, trim the docs (the 3k-line retrieval plan can be archived now that it has shipped), and clear the small follow-ups listed under §3.

### Rebrand to "Atlas"
Rename the product from "Atlas Brief" to "Atlas", together with new brand work (logo, identity, UI refresh). This touches the masthead, footer and Home copy in `App.tsx` and `HomePage.tsx`, the page title and meta tags, the README files, and possibly the Vercel and Render project names. Do it as one pass with the logo so the product isn't rebranded twice.

### Clear way back to Home
Right now the only way to get to Home is clicking the logo. Add an explicit "New brief" button (preferred: it names the action) and/or a Home link in the NavBar, visible on the Briefing, Archive and Settings pages.

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

- **Live check with real keys.** "Data centers and privacy in the US" should return 15 or more on-topic articles from at least 4 source types. Use the `briefing pipeline` log line to check the rerank fallback rate and latency.
- **Google News defaults to the US** (`google_news_source.py`: `plan.country or "US"`), which skews global topics. It also stores `news.google.com` wrapper URLs instead of the publisher URL, so the same Reuters story doesn't dedupe against Reuters from RSS.
- **GDELT's retry doesn't fit the budget.** Its own pacer plus a 429 retry can't complete inside the 8 s source timeout. Drop the retry or give GDELT its own budget.
- **Quota is spent before the request.** Timeouts and 429s still use up the daily budget.
- **Wrong module dependency.** `search_plan.py` and `rerank.py` import `extract_json` from `synthesis.briefing`; move it to a small shared helper.
- **Repeated article-building code.** Sources repeat the same "loop items → skip empty → build `Article`" code. A shared `article_from(...)` helper would remove one-off bugs, such as Guardian always being tagged `country="GB"`.
- **Stale Home copy.** "NewsAPI, GDELT and fifteen wire services" / "15 wire feeds" (`App.tsx`, `HomePage.tsx`); there are now 13 sources and about 27 RSS feeds.
- **422 hint mentions only NEWSAPI_KEY** (`main.py`), while the 502 hint lists every skipped key. Make them consistent.
- **Dead `huggingface_api_key`** in `config.py`.
- **Finance detection is too eager.** The word "market" turns on finance mode, so "labor market" topics call the finance APIs.
- **Rerank reply size.** The rerank reply may often hit the 8 s timeout at 60 candidates. If the live check shows frequent fallbacks, ask for a compact reply format.
- **Coverage inspector.** Show article count, source mix and the time window used on Signals, so a thin brief can be explained from the UI.

## 4. Database (Supabase)

Move user state off `localStorage` into Supabase. Today the archive, profile and settings are browser-only, and the backend keeps quotas and the briefing cache in process memory, so a Render restart or spin-down resets them.

- **First tables:** briefings (the archive), user profile/settings, and optionally the per-source daily quota counters and the briefing cache.
- **Features it unlocks:** shareable read-only briefing links, watchlist and "what changed since the last brief", multi-device sync, and personas stored server-side.
- **Open questions:** auth (Supabase Auth, or anonymous plus magic link), migrating existing `localStorage` archives, and row-level security policies.
