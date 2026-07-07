# Atlas Brief Overhaul — Summary

Branch: `overhaul/atlas-v3` (16 commits off `main`). Written 2026-07-07.

## Architecture decisions (as approved)

| # | Decision | Rationale |
| --- | --- | --- |
| DP1 | **Split deploy**: static frontend on Vercel (free), FastAPI stays a long-running Render free-tier process; `vercel.json` rewrites `/api/*` to Render | Serverless would silently break the in-memory cache and rate limiter, and GDELT's 5s/IP limit needs one process pacing all outbound calls. Same-origin rewrite means CORS is a backup layer, not load-bearing |
| DP2 | **Vite + React + TypeScript SPA** (no Next.js) | Pure client-side app (localStorage state, one endpoint, no SEO); Next's server layer is dead weight. TS mirrors the Pydantic contract |
| DP3 | **react-globe.gl** with bundled `world-atlas` topology | Purpose-built for lat/lng density data; no runtime CDN dependency; lazy-loaded so the UI is interactive before three.js (579 KB gz) arrives |
| DP4 | **No database** (user asked about Supabase) | Nothing in the current feature set needs server-side persistence; localStorage sits behind one guarded module so Supabase can slot in later if accounts/sync get approved |
| — | **Demo fallback gated** behind `DEMO_MODE=false` | Fabricated keyword "analysis" no longer masquerades as the product; keyless servers return an honest 503 |
| — | **Zero paid services** | Render free (cold starts accepted and communicated in the UI), Vercel Hobby, all-MIT/BSD deps, user-local Node 24 install |

## What was kept

- The backend's ingestion → processing → synthesis layering, untouched.
- The analytic system prompt (the product) — refined only by one injection-guard bullet and article delimiters; a test now asserts its key analytic anchors can't be silently gutted.
- Local TF-IDF embeddings, dedup logic, relevance filter design, in-memory cache.
- All legacy localStorage keys and shapes — existing users' saved briefings survive.
- Source Serif 4 display + JetBrains Mono data conventions; `render.yaml` as canonical backend deploy.

## What changed

**Backend (34 pytest tests, none existed before):**
- **Bug fixed:** focus term dropped from upstream boolean queries — searches for "trade" literally never queried "trade" (alias sort crowded it out).
- **Bug fixed:** GDELT timestamps were naive → aware/naive `TypeError` crash in fallback sort; now UTC-aware plus a defensive sort key.
- **Bug fixed:** feedparser fetched feeds internally with no timeout and swallowed network/SSL errors as silent zero-entry results (this exact failure reproduced locally); feeds are now fetched via httpx with 10s timeouts and logged failures.
- Word-boundary keyword matching ("cop" no longer matches "Copenhagen", "south" no longer matches "Southampton").
- Process-global GDELT pacer (all requests ≥5.5s apart, concurrent users can't 429 each other) on top of the existing retry.
- Synthesis refactored into testable pieces; malformed model JSON gets one corrective retry then a clean 502 (was: raw 500).
- Server-side URL allowlist: hallucinated/injected citation URLs are stripped; readings with unknown URLs dropped.
- Per-IP sliding-window rate limit on `/briefing` (6/min default), CORS origins from env, API-only backend (frontend serving removed).
- RSS coverage: BBC/Al Jazeera/Guardian/NPR + The Hindu, Deutsche Welle, France 24, AllAfrica, Straits Times (all verified live).
- Relevance threshold 0.30 validated against a 21-pair labeled fixture: recall 0.92 / precision 0.92 — it stays, now with evidence and a regression test.

**Frontend (rebuilt; 18 vitest tests):**
- 2,747-line `index.html` → Vite + React + TS component architecture (`frontend/`).
- Atlas/Cartographic design: navy chart band with graticule, parchment editorial surface, terracotta/teal/gold accents, Source Serif 4 + **Libre Franklin** (replacing Inter, per the brief's "evaluate the pairing") + JetBrains Mono.
- Interactive 3D globe hero: parchment hex-dot continents on a midnight sea, uniform ambient light (an atlas has no night side), terracotta signal columns sized by regional mention counts via a ~150-entry centroid table, camera easing to the densest region, lazy-loaded behind a spinning-compass fallback.
- Severity-coded alert stamps, "From the archive" historical-context insets, split-rule contradiction cards, map-pan scroll reveals (reduced-motion aware), staged cold-start-honest loading copy, archive with star/compare/print, profile + working preference toggles.
- Legacy XSS-hygiene concerns disappear structurally (React escaping; no `dangerouslySetInnerHTML`, no `document.write` print popup).
- The unguarded `JSON.parse` that could brick the legacy app on one corrupted localStorage entry is fixed in `storage.ts`.

## Security items (Section 5) — status

| Item | Status |
| --- | --- |
| CORS `*` | Fixed: env-driven origins + same-origin rewrite proxy |
| Secrets in logs/client | Verified clean; NewsAPI key moved from query param to `X-Api-Key` header so it can't hit URL logs |
| localStorage audit | Nothing sensitive; corrupted-entry and quota failures now degrade gracefully with a user-visible toast |
| `/briefing` input handling | 2–200 char validation (existing) + prompt delimiters + injection-guard rule + server-side URL allowlist |
| Flagged beyond the list | Unauthenticated endpoint → per-IP rate limiting added (full auth deferred; personal project for now). `backend/.env` was never committed to git history — verified, no rotation needed |

## Still open / flagged

1. **Verify the Render URL in `vercel.json`** — assumed `https://guaihack-global-brief-gen.onrender.com`; check your Render dashboard before first deploy, then set `ALLOWED_ORIGINS` to the real Vercel URL.
2. **Real-key synthesis path not exercised end-to-end** in this overhaul (zero-spend constraint): the live pipeline was verified in demo mode with real RSS/GDELT ingestion; synthesis parsing/allowlist/retry are unit-tested with fixtures. First real deploy should generate one briefing and eyeball the contradictions section.
3. **Render free-tier cold starts** (~1 min) are a real UX cost, mitigated by a warm-up ping and honest staged loading copy — an upgrade is the single highest-leverage paid improvement if the budget ever changes.
4. **Consciously dropped from legacy:** the Share button (nothing server-side to link to) and the "trending" strip (absorbed by Signal Analytics). Say the word and either returns.
5. GDELT remains inherently flaky on shared-IP hosts even with pacing; the app degrades to NewsAPI+RSS gracefully.
6. Globe chunk is 579 KB gzipped (three.js) — lazy-loaded so it never blocks the briefing UI; acceptable for the centerpiece, but worth knowing.

## Proposed new features (Section 7 — proposals only, nothing built)

1. **Focus watchlist with delta briefings.** The archive already keeps 12 briefings keyed by focus; on re-generate, diff key developments against the previous run and mark what's *new since last brief* — directly serving the time-constrained-student use case with data already stored.
2. **Globe as navigation.** Clicking a signal column filters the briefing to developments tagged with that region (the region→development mapping already exists in the view model). Makes the signature element functional, not decorative.
3. **Reading-time budget mode.** A "5-minute brief" toggle that keeps only critical/high alerts, top-3 developments, and one contradiction — pure client-side filtering of the existing payload, pairs with the existing compact-mode preference.
4. **Cross-region tension timeline.** Persist each briefing's `emerging_tensions` actors locally and chart recurring actor-pairs across archived briefings — a longitudinal view of the backend's existing tension data, still no server storage needed.
