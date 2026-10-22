# Home page, final round: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Home (roadmap project 3). The sources become live and explained, the lede states what Atlas does and who it's for, and a streamed loading screen keeps the hero globe playable while a briefing builds.

**Architecture:** The backend gains `GET /sources`, computed from the registry with no network or LLM calls. It also gains `POST /briefing/stream`, which runs the existing `/briefing` pipeline with an `emit` callback and writes NDJSON progress events. The frontend reads `/sources` through one session-cached loader shared by the lede, the provenance row, a new "How Atlas reads" section and the ledger. The loading screen is a state of `HomePage`, not a route, so the same mounted `GlobeView` carries over and gains a `loading` target and arcs.

**Tech Stack:** FastAPI and Pydantic v2 with pytest (Python 3.11). React 19, TypeScript, Vite and vitest. The globe uses custom three.js (`globe/engine.ts`).

**Spec:** `docs/superpowers/specs/2026-10-22-home-finish-design.md`. Read it before each task. Where this plan is silent, the spec governs.

## Working rules (from the owner)

- **Where to work:** the worktree `/Users/camlau/Developer/atlas/.claude/worktrees/home-finish`, branch `home/finish`. Never push. The owner merges into `main` from their own terminal.
- **Python:** `/Users/camlau/Developer/atlas/.venv/bin/python`. The worktree has no `.venv`. Run backend commands from the worktree root.
- **Frontend dependencies:** the worktree has no `node_modules`. Run `npm ci` in `frontend/` once before Task 1's frontend steps.
- **One command per Bash call:** Bash may refuse chained commands (`&&`, `cd x && …`), so use absolute paths or `git -C`.
- **Dev servers:** backend `… -m uvicorn backend.main:app --reload --port 8000`, frontend `npm run dev -- --port 5180 --strictPort`.

## Global Constraints

- **Design tokens** live only in `frontend/src/styles/tokens.css`. Add no new colours or fonts. IBM Plex Sans is the only family. Use `--accent` for progress and arcs, and never red or amber, which are reserved for heat.
- **Motion:** every animation sits under `@media (prefers-reduced-motion: no-preference)`, or is gated by `usePrefersReducedMotion()` in JS. Reduced motion gets an opacity crossfade only.
- **Numbers:** no source count is hard-coded anywhere in UI copy. Numbers one to nine are spelled out in prose (lede, section title), and 10 and up are digits. Label-style rows such as the provenance row and the ledger use digits.
- **"Feeds", not "newsrooms":** always "newsroom feeds", never "26 newsrooms".
- **No fake progress:** only stream events change ledger state. The one exception is the cold-start note after 8 s with no event.
- **`/briefing` stays byte-for-byte as it is:** same body, errors, cache and logging. Every existing test passes unchanged.
- **[[reshape-not-rebuild]]:** extend `HomePage`, `AskForm`, `GlobeView`, `engine.ts`, `registry.py`, `search_plan.py`, `synthesis/briefing.py` and `main.py`. Don't replace them.
- **Breakpoint:** 980px. Below it, the globe sits above the copy (Home's existing rule).

## Review Focus

1. **A focus with no place** ("chip export controls"): the ledger works, the globe keeps turning, nothing flies, and the contributing feed outlets light up as hotspots. Tests: Task 3, `test_plan_place_is_null_for_placeless_topics`, plus the ledger reducer case `place: null`.
2. **A stream body split mid-line, or several events in one chunk:** the parser yields each event exactly once. Test: Task 3, `ndjson.test.ts`.
3. **A cold backend that sends nothing for 8+ seconds,** then the stream arrives: the cold-start note shows, then hides on the first event. Test: Task 3, the ledger reducer's `coldStart` case.
4. **`/sources` failing or not deployed yet** (an old backend): the lede and row print the numberless copy, and the section prints the static names with no on/off states. Tests: Task 1, `loadSources` returns null on 404, and the section renders the fallback list. Task 2, the lede's numberless case.
5. **Cancel or Back pressed mid-stream:** the request aborts, Home returns with no error shown, and no history entry is left behind. Test: Task 3, `useGenerateBriefing.test.tsx` cancel and popstate cases.

---

### Task 1: Explaining the sources (piece 3)

**Files:**
- Modify: all 13 `backend/ingestion/*_source.py` files (add `SOURCE_LABEL`)
- Modify: `backend/ingestion/registry.py` (`Source.label`, `source_from_module`)
- Modify: `backend/ingestion/rss_source.py` (add `feed_outlets()`)
- Create: `backend/sources_info.py`
- Modify: `backend/main.py` (add a `GET /sources` route)
- Test: `backend/tests/test_sources_info.py`
- Create: `frontend/src/lib/sources.ts`, `frontend/src/lib/sources.test.ts`
- Create: `frontend/src/components/HowAtlasReads.tsx`, `frontend/src/components/howAtlasReads.css`, `frontend/src/components/HowAtlasReads.test.tsx`
- Modify: `frontend/src/routes/HomePage.tsx` (the provenance row and the section mount), `frontend/src/routes/home.css`
- Modify: `CLAUDE.md` (the "Adding a source" line now mentions `SOURCE_LABEL`)

**Interfaces:**
- Produces (backend):
  - `Source.label: str`.
  - `rss_source.feed_outlets() -> list[str]`: distinct outlets in `RSS_FEEDS` order, with sub-feeds collapsed. It returns 23 names.
  - `sources_info.sources_payload() -> dict` with the shape `{"services": [{"name","label","enabled","finance_only"}], "feeds": {"count": int, "outlets": [str]}}`.
  - `GET /sources` returns that payload.
- Produces (frontend, `lib/sources.ts`):
  ```ts
  export type SourceService = { name: string; label: string; enabled: boolean; financeOnly: boolean }
  export type SourcesInfo = { services: SourceService[]; feeds: { count: number; outlets: string[] } }
  export const SOURCES_CACHE_KEY = 'atlasSourcesV1'
  export function peekSources(): SourcesInfo | null      // session copy, sync
  export function loadSources(signal?: AbortSignal): Promise<SourcesInfo | null>
  export function useSources(): SourcesInfo | null       // peek on first render, then load
  export function liveServiceCount(info: SourcesInfo): number  // enabled && !financeOnly (RSS is not in services)
  export function countWord(n: number): string           // 1..9 → 'one'..'nine', else String(n)
  export const STATIC_SERVICE_LABELS: string[]           // fallback names when /sources fails
  ```

- [ ] **Step 1: Write the failing backend tests** in `backend/tests/test_sources_info.py`:
  - `test_payload_lists_every_non_rss_source`: `{s["name"] for s in payload["services"]}` equals `{s.name for s in SOURCES} - {"rss"}`, and there are 12 entries.
  - `test_enabled_follows_keys`: `monkeypatch.setattr(settings, "brave_api_key", None)` gives brave `enabled is False`. `"x"` gives `True`. Google News and GDELT are always `True`.
  - `test_finance_flags`: `finance_only` is `True` exactly for `{"finnhub", "marketaux", "alphavantage"}`.
  - `test_feeds_count_and_collapsed_outlets`: `count == len(RSS_FEEDS) == 26`. `outlets` has 23 entries and includes `"New York Times"` and `"NPR"` exactly once. It has no entry starting `"New York Times "`.
  - `test_every_source_has_a_label`: every `label` is non-empty, and `gdelt` → `"GDELT 2.0"`, `google_news` → `"Google News"`.
  - `test_sources_endpoint`: `TestClient(main.app).get("/sources")` returns 200 with `services` and `feeds` keys.

- [ ] **Step 2: Run them and confirm they fail**
  Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_sources_info.py -v`
  Expected: FAIL (`ModuleNotFoundError: backend.sources_info`).

- [ ] **Step 3: Implement the backend.**
  - **Labels:** add a `SOURCE_LABEL` to each module:
    - newsapi "NewsAPI", gdelt "GDELT 2.0", rss "Newsroom feeds", google_news "Google News", guardian "The Guardian", gnews "GNews", newsdata "NewsData.io"
    - brave "Brave Search", tavily "Tavily", exa "Exa", finnhub "Finnhub", marketaux "Marketaux", alphavantage "Alpha Vantage"
  - **Registry:** add `label: str = ""` to `Source`, after `enabled` and before `finance_only`, so positional construction in the existing tests still works. `source_from_module` reads `module.SOURCE_LABEL`.
  - **`feed_outlets()`:** collapses with an explicit map: "New York Times World/U.S./Technology" → "New York Times", "NPR World/NPR News" → "NPR", "The Guardian World" → "The Guardian", "BBC World" → "BBC", "CNN World" → "CNN", "Fox News World" → "Fox News", "ABC News International" → "ABC News", "CBS News World" → "CBS News", "CNBC Top News" → "CNBC". Everything else passes through, deduplicated in order.
  - **`sources_payload()`:** reads `SOURCES` at call time, so tests that monkeypatch settings see the change. It's cheap, so there's no cache.
  - **Route:** in `main.py`, `@app.get("/sources") async def sources_endpoint() -> dict: return sources_payload()`.

- [ ] **Step 4: Run the backend tests and confirm they pass**
  Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -v`
  Expected: all PASS, including the existing `test_registry.py`.

- [ ] **Step 5: Write the failing frontend tests** in `lib/sources.test.ts`, mirroring `trending.test.ts`'s fetch and sessionStorage mocking:
  - `loadSources` maps `finance_only` to `financeOnly` and caches under `SOURCES_CACHE_KEY`. A second call doesn't fetch.
  - `loadSources` resolves `null` on 404, on a network error and on a malformed body (missing `feeds.count`).
  - `peekSources()` returns the cached copy synchronously, and returns null after 30 minutes (`CACHE_MS = 30 * 60_000`).
  - `liveServiceCount` for the live configuration (8 enabled non-finance and finnhub enabled) returns `8`.
  - `countWord(8) === 'eight'`, `countWord(1) === 'one'`, `countWord(26) === '26'`, `countWord(10) === '10'`.

- [ ] **Step 6: Run them and confirm they fail.** Run `npx vitest run src/lib/sources.test.ts` in `frontend/`. Expected: FAIL (module not found).

- [ ] **Step 7: Implement `lib/sources.ts`.** Follow `lib/trending.ts` exactly: a `try/catch` around every storage access, and any failure reads as `null`. `useSources` is a `useState(peekSources)` plus an effect that calls `loadSources` with an `AbortController`. `STATIC_SERVICE_LABELS` holds the 12 labels from Step 3 in registry order.

- [ ] **Step 8: Write the failing component tests** in `HowAtlasReads.test.tsx`:
  - **With info:**
    - the section has `id="how-atlas-reads"` and the title "Eight news services, 26 newsroom feeds, one briefing."
    - the three points are headed "Breadth", "Corroboration" and "Disagreement"
    - an enabled service renders without "off", and `Brave Search` disabled renders with "off"
    - finance services appear only after the text "Finance questions add"
    - the feeds line names "BBC" and "Al Jazeera"
  - **With `info={null}`:**
    - the title is "News services and newsroom feeds, one briefing."
    - all `STATIC_SERVICE_LABELS` render, and none says "off"
  - **HomePage provenance**, added to the existing HomePage tests or a new `HomePage.test.tsx` if none exists: with a cached `SOURCES_CACHE_KEY`, the row reads "8 news services", "26 newsroom feeds", "Model-written, source-cited", and a link "How Atlas reads" with `href="#how-atlas-reads"`. With no cache and a failing fetch, it reads "News services" and "Newsroom feeds".

- [ ] **Step 9: Implement `HowAtlasReads({ info }: { info: SourcesInfo | null })`** and mount it in `HomePage` after `.home-inner`, inside `section.home`.
  - **Copy:** the three points use the spec's copy, pinned verbatim in the spec's "Piece 3" section.
  - **Feeds line:** "26 newsroom feeds: " followed by the first 8 outlets and ", …".
  - **Styling:** `howAtlasReads.css` uses an `--ink` top rule, a label-style kicker "How Atlas reads the news", and a three-column grid that stacks below 980px. Disabled entries use `--ink-3`. Use tokens only.
  - **Provenance row:** it keeps its `span`s. The first two come from `useSources()` (digits). The link scrolls with `scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })` and calls `preventDefault`. It still works with JS off through the `href`.

- [ ] **Step 10: Run all checks.** In `frontend/`, run `npx vitest run`, then `npm run lint`, then `npm run build`. Expected: all green.

- [ ] **Step 11: Commit**
  ```bash
  git -C /Users/camlau/Developer/atlas/.claude/worktrees/home-finish add -A backend frontend/src CLAUDE.md
  git -C /Users/camlau/Developer/atlas/.claude/worktrees/home-finish commit -m "feat(home): live sources endpoint and 'How Atlas reads' section"
  ```
  End the commit message with the `Co-Authored-By` line.

---

### Task 2: Value-prop lede (piece 2)

**Files:**
- Modify: `frontend/src/routes/HomePage.tsx` (`p.home-lede`)
- Create: `frontend/src/components/HomeLede.tsx`, `frontend/src/components/HomeLede.test.tsx`

**Interfaces:**
- Consumes: from Task 1, `useSources()`, `liveServiceCount()` and `countWord()`.
- Produces: `HomeLede({ info }: { info: SourcesInfo | null })`, which renders the `p.home-lede` element.

- [ ] **Step 1: Write the failing tests** in `HomeLede.test.tsx`. Assert on `textContent`, normalised for whitespace.
  - **With info** (8 live services, 26 feeds), the text is exactly:
    `Know what changed, where it happened, and who disagrees. Atlas reads across eight news services and 26 newsroom feeds and writes a cited briefing for analysts, writers and anyone who follows world events seriously.`
    The first sentence's clause "what changed, where it happened, and who disagrees" is inside an `<em>`.
  - **With `info={null}`:** `…Atlas reads across a range of news services and newsroom feeds and writes a cited briefing for…`, and the text contains no digit.
  - **With 3 live services:** it contains "three news services".

- [ ] **Step 2: Run the tests and confirm they fail.** Run `npx vitest run src/components/HomeLede.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `HomeLede`** and replace the lede `<p>` in `HomePage` with `<HomeLede info={sources} />`. `sources` is the same `useSources()` value Task 1's provenance row reads. Call `useSources()` once in `HomePage` and pass it down to both.

- [ ] **Step 4: Run all checks.** Run `npx vitest run`, `npm run lint` and `npm run build`. Expected: all green.

- [ ] **Step 5: Commit** with the message `feat(home): value-prop lede with live source counts`.

---

### Task 3: Loading screen with a streamed, playable globe (piece 1)

This is the large task. It has three sub-parts, each ending in a commit, and the reviewer gates the whole task: 3A backend place and stream, 3B frontend stream client and ledger, 3C screen, globe and transition.

**Files:**
- 3A:
  - modify `backend/search_plan.py` (the `place` field, the prompt and the fallback)
  - create `backend/places.py` (server-side place names)
  - modify `backend/ingestion/registry.py` (`on_source`)
  - modify `backend/synthesis/briefing.py` (`on_section`)
  - modify `backend/main.py` (extract `_run_pipeline`, add `/briefing/stream`)
  - tests in `backend/tests/test_search_plan.py`, `test_registry.py`, `test_synthesis.py`, and a new `test_stream.py`
- 3B:
  - create `frontend/src/lib/ndjson.ts` and its test
  - create `frontend/src/lib/ledger.ts` and its test (types and reducer)
  - modify `frontend/src/lib/api.ts` (`requestBriefingStream`)
  - modify `frontend/src/state/useGenerateBriefing.ts`
  - create `frontend/src/state/useGenerateBriefing.test.tsx`
- 3C:
  - create `frontend/src/components/LoadingLedger.tsx`, `loadingLedger.css` and its test
  - create `frontend/src/lib/places.ts` and its test (readout country table and zones)
  - create `frontend/src/globe/feedCities.ts`
  - modify `globe/engine.ts` (`FrameInfo.pointer`), `globe/readout.ts` and its test, `globe/GlobeView.tsx` (the `loading` prop)
  - modify `components/AskForm.tsx` (drop the timed `STAGES`), `routes/HomePage.tsx` and `routes/home.css`

**Interfaces:**
- Produces (3A, backend):
  - `SearchPlan.place: str | None = None`.
  - `places.find_place(text: str) -> str | None`: the longest word-bounded known place name contained in `text`, in display case.
  - `ingest(plan, sources=None, on_source: Callable[[str, SourceStat, list[Article]], Awaitable[None]] | None = None)`.
  - `synthesize_briefing(focus, articles, on_section: Callable[[str], Awaitable[None]] | None = None)`.
  - `main._run_pipeline(focus: str, emit: Callable[[dict], Awaitable[None]] | None) -> Briefing`, which raises `HTTPException` exactly as today.
  - The event dicts are exactly the spec's table, with `type` keys `plan`, `source`, `ranked`, `section`, `briefing` and `error`.
- Produces (3B, frontend):
  ```ts
  // lib/ledger.ts
  export type StreamEvent =
    | { type: 'plan'; place: string | null; queries: number; is_finance: boolean; sources: string[] }
    | { type: 'source'; name: string; count: number; status: 'ok'|'empty'|'timeout'|'error'|'deadline'; outlets: Record<string, number> }
    | { type: 'ranked'; merged: number; deduped: number; kept: number; outlets: number }
    | { type: 'section'; name: 'developments'|'signals'|'alerts' }
    | { type: 'briefing'; briefing: ApiBriefing }
    | { type: 'error'; status: number; detail: string }
  export type LedgerState = {
    focus: string; coldStart: boolean; streaming: boolean
    plan: { place: string | null; queries: number; sources: string[] } | null
    sources: Record<string, { count: number; status: string } | undefined>
    articles: number; outlets: Set<string>; feedOutlets: Record<string, number>
    ranked: { merged: number; kept: number; outlets: number } | null
    sections: Set<'developments'|'signals'|'alerts'>
  }
  export function initialLedger(focus: string): LedgerState
  export function reduceLedger(s: LedgerState, a: StreamEvent | { type: 'cold' } | { type: 'fallback' }): LedgerState
  // lib/ndjson.ts
  export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown>
  // lib/api.ts
  export class StreamUnavailableError extends Error {}
  export async function requestBriefingStream(focus: string, signal: AbortSignal, onEvent: (e: StreamEvent) => void, getToken?: () => Promise<string|null>): Promise<ApiBriefing>
  // state/useGenerateBriefing.ts — return value gains:
  { ledger: LedgerState | null; cancel: () => void }
  ```
- Produces (3C):
  - `places.ts`: `nearestCountry(lat: number, lng: number): { name: string; timeZone: string | null } | null`, with an 800 km radius.
  - `readout.ts`: `formatReadout(lat: number, lng: number, now: Date): string`.
  - `GlobeViewProps.loading?: { target: { lat: number; lng: number } | null; feedOutlets: string[] }`.
  - `FrameInfo` gains `pointer: { lat: number; lng: number } | null`. The engine's existing `readout` string field is removed, and `GlobeView` formats it with `formatReadout`.

#### 3A: backend

- [ ] **Step 1: Write the failing tests.**
  - **`test_search_plan.py`:**
    - `test_rule_plan_finds_subject_place`: `rule_plan("Sudan's ceasefire talks").place == "Sudan"`, `rule_plan("shipping in the Strait of Hormuz").place == "Strait of Hormuz"`, and `.country is None` for both.
    - `test_plan_place_is_null_for_placeless_topics`: `rule_plan("chip export controls").place is None`.
    - `test_llm_place_is_clamped`: `_clamp({"queries": ["x"], "place": "  Iran "}, rule_plan("x")).place == "Iran"`. A non-string or empty `place` falls back to the rule plan's place. A value longer than 60 chars becomes `None`.
    - `test_country_unchanged_by_place`: `rule_plan("housing costs in the UK").country == "GB"`.
  - **`test_registry.py`:**
    - `test_on_source_fires_per_active_source`: with two fake sources, one OK and one that sleeps past `ingest_deadline_seconds`, which you monkeypatch to 0.05, the callback receives both names. The slow one has status `"deadline"`.
    - `test_on_source_failure_does_not_fail_ingest`: a raising callback still returns all articles.
  - **`test_synthesis.py`:** `test_on_section_reports_each_section` patches `_write_section` and `_optional_section` with fakes in the file's existing style. The callback receives the set `{"developments", "signals", "alerts"}`.
  - **`test_stream.py`:** reuse `test_api.py`'s `client` fixture shape, with a `fake_ingest(plan, on_source=None)` that awaits `on_source("rss", SourceStat(1, "ok", 5), [article])` when given one. Parse `res.text.splitlines()` as JSON.
    - `test_stream_success_order`: the types begin `plan`, `source`, `ranked` and end `briefing`. `res.headers["content-type"]` starts with `application/x-ndjson`. The `briefing` payload's keys equal `/briefing`'s JSON keys for the same focus. (Demo mode has no section calls, so `section` events are asserted in `test_synthesis.py`.)
    - `test_stream_cache_hit_emits_only_briefing`: with `cache_ttl_minutes=15`, the second call yields exactly one line, `type == "briefing"`.
    - `test_stream_rate_limit_is_plain_http`: a 429 with the same `detail` as `/briefing`, and a body that isn't NDJSON.
    - `test_stream_no_articles_is_error_event`: an empty ingest ends with `{"type": "error", "status": 502, "detail": <same text as /briefing>}`.
    - `test_stream_422_is_error_event` and `test_stream_503_is_error_event`: the same idea, mirroring `test_api.py`'s 422 and 503 tests.

- [ ] **Step 2: Run the tests and confirm they fail.**
  Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests/test_search_plan.py backend/tests/test_registry.py backend/tests/test_synthesis.py backend/tests/test_stream.py -v`
  Expected: the new tests FAIL.

- [ ] **Step 3: Implement 3A.**
  - **`places.py`:** `PLACE_NAMES`, a display-case list made of the countries in `frontend/src/lib/centroids.ts` plus "Strait of Hormuz", "Red Sea", "Gaza", "West Bank", "Taiwan Strait", "South China Sea", "Black Sea", "Sahel", "Horn of Africa", "Kashmir" and "Donbas". `find_place` matches longest first, case-insensitive, with word boundaries, the same rule as `resolveRegion`. It treats "us"/"uk" as places only when uppercase or dotted. Reuse `_strip_places`'s logic if it fits.
  - **`search_plan.py`:**
    - **Field and prompt:** add the `place` field. Add one prompt line: `- "place": the English name of the single country or region the story is about (for example "Sudan's ceasefire talks" -> "Sudan"), or null when it is not about one place. This is separate from "country".`
    - **`_clamp`:** reads `place` (a stripped str of at most 60 chars) or uses `fallback.place`.
    - **`rule_plan`:** sets `place=find_place(focus)`.
  - **`registry.ingest`:** wrap each task so that when it finishes, `on_source(name, stat, articles)` is awaited inside `try/except Exception` with a `logger.warning`. The deadline-cancelled sources fire after cancellation with `SourceStat(0, "deadline", …)` and `[]`. Keep the existing `asyncio.wait` deadline semantics.
  - **`synthesize_briefing`:** call a local `async def report(name)` that awaits `on_section` safely, the same way:
    - when `developments()` gets its partial, *before* starting the enrichment `gather`
    - when `signals_task` completes, via `add_done_callback` scheduling the report task, or by wrapping `_optional_section`
    - when alerts complete
  - **`main.py`:**
    - **`_run_pipeline`:** move everything after the budget check into `_run_pipeline(focus, emit)`, including the cache write and `enforce_url_allowlist`.
    - **When `emit` is set:**
      - after `plan_search`, emit `plan` (`sources` = names of active sources: enabled, and not finance-only unless `plan.is_finance`; compute it with the same filter `ingest` uses)
      - pass `on_source` to `ingest`, emitting `source` with `outlets = Counter(a.source for a in articles)`
      - emit `ranked` (`outlets = len({a.source for a in merged})`)
      - pass `on_section`
    - **When `emit` is None:** call `ingest(plan)` and `synthesize_briefing(focus, articles)` with their old signatures, so the existing tests' monkeypatched fakes keep working.
    - **`/briefing`** = the rate limit, Turnstile, cache hit and budget, then `return await _run_pipeline(focus, None)`.
    - **`/briefing/stream`:**
      - **Up-front checks:** rate limit, Turnstile and budget, the same as `/briefing`, raising plain HTTP errors. Cache hit → a one-line stream.
      - **Otherwise:** an `asyncio.Queue`, a background task running `_run_pipeline(focus, queue.put)`, and a `StreamingResponse(gen(), media_type="application/x-ndjson", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})`.
      - **What `gen()` yields:** each event as `json.dumps(event) + "\n"`. The final `briefing` uses `briefing.model_dump(mode="json")`. An `HTTPException` becomes `{"type": "error", "status": e.status_code, "detail": e.detail}`, and any other exception becomes `{"type": "error", "status": 500, "detail": "Something went wrong while generating the briefing."}` plus a `logger.exception`.
      - **Client disconnect:** let the pipeline task finish (don't cancel it), so the cache fills. Note this in the spec's notes.

- [ ] **Step 4: Run all backend tests and confirm they pass.**
  Run: `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -v`
  Expected: all PASS, with `test_api.py` untouched.

- [ ] **Step 5: Commit** with the message `feat(briefing): stream pipeline progress as NDJSON; plan names the story's place`.

#### 3B: stream client and ledger

- [ ] **Step 6: Write the failing tests.**
  - **`ndjson.test.ts`:** build a `ReadableStream` from chunks.
    - `['{"a":1}\n{"b"', ':2}\n']` → `[{a:1},{b:2}]`
    - `['{"a":1}\n{"b":2}\n{"c":3}']` (no trailing newline) → 3 objects
    - a blank line is skipped
    - a malformed line throws `SyntaxError`
  - **`ledger.test.ts`** (`reduceLedger`):
    - **`plan`** sets `plan` and clears `coldStart`.
    - **`source`** accumulates `articles`, unions the outlet keys into `outlets`, and for `name === 'rss'` copies `outlets` into `feedOutlets`.
    - **"N of M":** `Object.values(sources).filter(Boolean).length` of `plan.sources.length` (a 2-of-9 case).
    - **`ranked`** sets `ranked`. **`section`** adds to `sections`.
    - **`{type:'cold'}`** sets `coldStart: true` only while no event has arrived. Once any event has arrived, it's a no-op.
    - **`{type:'fallback'}`** sets `streaming: false`.
    - **`place: null`** keeps `plan.place === null`.
  - **`useGenerateBriefing.test.tsx`:** mock `lib/api` and use fake timers.
    - **Success:** the stream success navigates with `{ replace: true }` to `/brief/:id`, and `ledger` was non-null while loading.
    - **Fallback:** `requestBriefingStream` rejecting with `StreamUnavailableError` calls `requestBriefing` exactly once, and the ledger gets `fallback`.
    - **Cold start:** no event for 8000 ms dispatches `cold`.
    - **Cancel:** `cancel()` aborts the signal, ends loading with `error === null`, and calls `history.back()` once, only if the hook pushed an entry.
    - **Back:** a `popstate` while loading behaves like cancel, without calling `history.back()`.
    - **Error event:** an `error` event surfaces `detail` as `error`.

- [ ] **Step 7: Run the tests and confirm they fail.** Run `npx vitest run src/lib/ndjson.test.ts src/lib/ledger.test.ts src/state/useGenerateBriefing.test.tsx`. Expected: FAIL.

- [ ] **Step 8: Implement 3B.**
  - **`readNdjson`:** `TextDecoder` with `{ stream: true }`, buffering until the newline, and flushing at the end.
  - **`requestBriefingStream`:**
    - **Request:** the same token and headers as `requestBriefing`, sent to `POST /api/briefing/stream`.
    - **Unavailable:** a 404 or 405, or a missing `res.body`, throws `StreamUnavailableError`.
    - **Other failures:** any other `!res.ok` throws `Error(detail)`, parsed like `requestBriefing`.
    - **Events:** they go to `onEvent`. An `error` event throws `Error(detail)`, and a `briefing` event resolves it.
    - **Stream ends without either:** throw `Error('The connection closed before the briefing was ready. Please try again.')`.
  - **`useGenerateBriefing`:**
    - **On submit:** set the ledger to `initialLedger(focus)`, `history.pushState({ atlasLoading: true }, '')`, start an 8 s cold timer, and keep one `AbortController` for the stream, the fallback, `AbortSignal.timeout(120_000)` and cancel, using `AbortSignal.any`.
    - **Cancel and popstate:** both abort. Cancel then calls `history.back()`, and popstate doesn't.
    - **Success:** `navigate(\`/brief/${id}\`, { replace: true })`. Replace swaps the pushed entry for the briefing.
    - **Abort:** an abort caused by cancel sets no error.
    - **Cleanup:** the hook removes its listeners on unmount.

- [ ] **Step 9: Run the tests and confirm they pass.** Run `npx vitest run`. Expected: all PASS.

- [ ] **Step 10: Commit** with the message `feat(home): stream client, ledger state and cancel for briefing generation`.

#### 3C: screen, globe and transition

- [ ] **Step 11: Write the failing tests.**
  - **`places.test.ts`:**
    - `nearestCountry(15.5, 41.8)?.name === 'Eritrea'`
    - `nearestCountry(51.2, 10.5)?.name === 'Germany'` (never "NATO" or "EU")
    - `nearestCountry(0, -30) === null` (mid-Atlantic)
    - `nearestCountry(35.9, 104.2)?.timeZone === 'Asia/Shanghai'`
    - `nearestCountry(39.8, -98.6)?.timeZone === null` (US, multi-zone)
  - **`readout.test.ts`:**
    - `formatReadout(15.5, 41.8, new Date('2026-10-22T11:32:00Z'))` → `'Eritrea · 14:32 local · 15.50° N  41.80° E'`. Keep the engine's existing coordinate format, moved into `readout.ts` as `fmtCoord`.
    - Over the ocean → coordinates only.
    - US → `'United States · 39.80° N  98.60° W'`.
  - **`LoadingLedger.test.tsx`:** given ledger states, it renders:
    - the kicker "Preparing your briefing" and the focus as the heading
    - "Sudan · 5 queries", or "5 queries" with no place
    - "2 of 9 sources in · 40 articles from 12 outlets"
    - a grid line "Newsroom feeds 6" for `rss`, "…" for pending, "no results" for `empty`, and "timed out" for `timeout`/`deadline`
    - "214 → 58 kept"
    - a write row that ticks off the three sections, then "Adding context and photos…"
    - the cold note text from the spec when `coldStart`, and nothing when it's false
    - "Working…" rows when `streaming === false`
    - a "Cancel" button that calls `onCancel`
    - the class `ledger-enter` only when `reduced === false`
  - **HomePage test:** while `loading`, `.home-copy` is replaced by the ledger, and the same `Globe` element is still mounted (assert the same DOM node before and after).

- [ ] **Step 12: Run the tests and confirm they fail.** Run `npx vitest run src/lib/places.test.ts src/globe/readout.test.ts src/components/LoadingLedger.test.tsx`. Expected: FAIL.

- [ ] **Step 13: Implement 3C.**
  - **`places.ts`:**
    - **The table:** `COUNTRIES: { name: string; lat: number; lng: number; timeZone: string | null }[]`. It's hand-written from the country section of `centroids.ts` (lines 7–59), with one entry per country and aliases collapsed ("burma" becomes Myanmar, "drc" becomes Democratic Republic of the Congo, "usa"/"us" become United States).
    - **Zones:** an IANA zone for single-zone countries, and `null` for US, Canada, Mexico, Brazil, Russia, Australia, Indonesia, Kazakhstan, Mongolia, DRC, Chile and Argentina.
    - **Lookup:** haversine to the nearest entry, or `null` beyond 800 km.
  - **Readout:** `engine.ts` reports `pointer` lat/lng in `FrameInfo` instead of the formatted string, and `GlobeView`'s `onFrame` calls `formatReadout(lat, lng, new Date())`. This applies in every mode (designer's call: one readout). Local time uses `Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone })`.
  - **`feedCities.ts`:** `FEED_CITIES: Record<string, [number, number]>`, keyed by the collapsed outlet names from Task 1's `feed_outlets()`. Add a `feedCity(outlet: string)` that collapses an `RSS_FEEDS` name such as "New York Times World" with the same map. Use HQ cities, with AllAfrica in Washington, DC, and note it.
  - **`GlobeView`:**
    - **The prop:** a `loading` prop in hero mode. It's a new prop, not a new mode, so the engine isn't recreated: the engine-creation effect keys only on `mode` and `reduced`.
    - **With `loading.target`:** `engine.focusOn(target)` and `setHold(true)`. Arcs come from `feedCity(o)` for each `o` in `loading.feedOutlets` to the target, built with `slerpArc` and `--accent`'s value, read the way the briefing arcs read their colour. With reduced motion, the arcs simply appear: the engine draws arcs whole already, so draw-on animation is optional and only under no-preference.
    - **With no target:** `setHotspots` at the feed cities.
    - **When `loading` is cleared:** reset to `HERO_HOTSPOTS` and no arcs.
  - **`HomePage`:**
    - **Swap:** `loading && ledger ? <LoadingLedger …/> : <div className="home-copy">…</div>` inside the same `.home-inner`, with the `.home-globe` element unchanged.
    - **Globe props:** pass `loading={{ target: resolveRegion(ledger.plan?.place ?? '') ?? resolveRegion(ledger.focus), feedOutlets: Object.keys(ledger.feedOutlets) }}`, but only once `ledger.plan` exists, so it doesn't fly before the plan.
    - **Contours:** hide them while loading.
  - **`AskForm`:** delete `STAGES` and `useStagedMessage` and the `ask-stage` paragraph. The ledger owns the cold note now, and the button's `Briefing…` label stays. Update `AskForm.test.tsx` for the removed status line.
  - **CSS** (`loadingLedger.css`, `home.css`):
    - **Rows:** stage rows have `--rule` hairlines. The current row uses `--accent`, finished rows `--ink`, and waiting rows `--ink-3`.
    - **Entrance:** `.ledger-enter > *` uses a `drop` keyframe (`translateY(-8px)` and opacity 0 → none), staggered 60 ms per child and about 700 ms total, all inside `@media (prefers-reduced-motion: no-preference)`.
    - **Copy exit:** `.home-copy` leaves with opacity and `translateY(6px)` over 250 ms. The ledger mounts after it, or the two overlap in the same grid cell via `grid-area`; the builder picks.
    - **Reduced motion:** opacity only.
    - **The phrase:** the focus moving into the heading is a FLIP from the input's rect when available, else a fade-up (the spec's builder choice).
    - **Globe growth:** while loading, `.home-globe` gets `transform: scale(1.04)` with a transition, under no-preference only.
    - **Hint line:** "Drag to look around. Your briefing opens when it's ready." goes under the globe while loading.

- [ ] **Step 14: Run all checks.** Run `npx vitest run`, `npm run lint` and `npm run build` in `frontend/`, and `/Users/camlau/Developer/atlas/.venv/bin/python -m pytest backend/tests -v`. Expected: all green.

- [ ] **Step 15: Check it in the running app.** Start the backend on :8000 with real keys from `backend/.env` and the frontend on :5180, then confirm each of the following:
  - **Live briefing:** "Sudan ceasefire talks" fills the ledger stage by stage, the globe flies to Sudan with arcs from feed cities, dragging shows "Sudan · HH:MM local", and the briefing opens on its own.
  - **A placeless focus:** "chip export controls" doesn't fly, and the feed cities light up.
  - **Reduced motion:** with it emulated in DevTools, everything crossfades and nothing flies.
  - **No WebGL:** with WebGL disabled, the ledger shows over `StaticGlobe`.
  - **Fallback:** temporarily return 404 from `/briefing/stream` (a local edit, not committed), and the briefing still arrives with "Working…" rows.
  - **Cancel and Back:** each returns to Home with no error, and Back afterwards doesn't land on a dead loading state.
  - **Phone width:** at 390px the globe is above the ledger and can be dragged.

- [ ] **Step 16: Update the docs.**
  - **CLAUDE.md:** add one sentence to the backend pipeline paragraph: "`POST /briefing/stream` runs the same pipeline with an `emit` callback and writes NDJSON progress events; `/briefing` is the fallback." Add a Home loading-screen line to the Frontend paragraph.
  - **The spec's notes:** record the deviations (the disconnect policy, AllAfrica's city, and the readout now running in every mode).

- [ ] **Step 17: Commit** with the message `feat(home): loading screen with streamed ledger and playable globe`.

---

## After the last task

Run the whole-branch review, then give the owner the merge command for their own terminal:

```bash
git -C /Users/camlau/Developer/atlas merge --ff-only home/finish
```

The streaming check on Vercel waits until the owner deploys (see the spec's "Done when").
