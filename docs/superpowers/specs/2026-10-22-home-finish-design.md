# Home page, final round: design

Date: 2026-10-22. Branch: `home/finish` (worktree `.claude/worktrees/home-finish`, cut from `main` at 07e4e55). This round finishes roadmap project 3 (Home) in one sweep, with three pieces:

1. A loading screen with a live, playable globe, driven by a new streaming briefing endpoint.
2. Value-prop copy in the Home lede.
3. An explanation of Atlas's sources, with counts that come from the server.

The Hotspots tab (project 4) and the Commons fallback for failed outlet photos (BACKLOG) are out of scope.

## Why

The owner wants Atlas to read as a **serious, confident, precise analytical tool** for anyone who follows world events seriously. The globe is a pillar feature they want to keep investing in. Today a briefing takes 20 to 60 seconds, the longer end on a cold Render instance, and the person watches timed status text under the ask box. That wait should be worth watching, not a spinner.

The provenance row ("Google News · NewsAPI · GDELT 2.0 · 26 newsroom feeds") and the lede ("thirteen news sources") also undersell Atlas and get it slightly wrong. Thirteen integrations exist, but only the ones with API keys run, so on the live site a general question uses 9. Through the aggregators they reach tens of thousands of outlets. Precision matters to the identity, so every number on the page must be true.

[[reshape-not-rebuild]] is binding: everything below evolves `HomePage`, `AskForm`, the provenance row, `GlobeView`/`engine.ts` and the `/briefing` pipeline. It does not replace them.

## Facts this design rests on (checked 2026-10-22)

- `backend/ingestion/registry.py` has 13 sources. Three are keyless: Google News, GDELT, and RSS (the 26 newsroom feeds in `rss_source.RSS_FEEDS`). Three are finance-only: Finnhub, Marketaux, Alpha Vantage.
- **Keys set on Render (per the owner):** NewsAPI, Guardian, GNews, NewsData, Tavily, Exa, Finnhub (and `HUGGINGFACE_API_KEY`, which no source reads).
  - So on the live site a general question runs **9 sources**: 8 news services plus the newsroom feeds bundle.
  - A finance question runs 10.
  - Brave, Marketaux and Alpha Vantage are off.
  - The owner wrote the Exa key as `EXA_API_KE`. If Render has it spelled that way, Exa is off too. The live `/sources` count will show this either way.
- `Article.source` is the outlet name, so distinct outlets per briefing can be counted exactly.
- `RSS_FEEDS` has 26 feeds from 23 distinct outlets: New York Times has 3 feeds and NPR has 2. So the page says "26 newsroom feeds" (true) and never "26 newsrooms" (false).
- `SearchPlan.country` is **not** the story's place. It's an ISO alpha-2 *coverage filter*, set only for "domestic news of X" questions. The planning prompt keeps it null when the country is the subject ("elections in Iran"). The globe's target therefore needs its own field (see "The place" below).
- The engine already has `setArcs`, `setHotspots`, `focusOn`, `zoomTo` and drag momentum, and its pointer readout shows coordinates (`readout.ts`). `lib/centroids.ts` maps region names to lat/lng.
- Only `HomePage` generates briefings (`useGenerateBriefing`), so the loading screen only has to work there.

## Piece 1: the loading screen

### What the owner decided (from mockups)

- **Takes over:** while a briefing generates, the loading screen replaces Home completely. It doesn't sit beside Home's content.
- **Layout A:** a ledger column on the left and the globe on the right. This matches Home's own grid (`.home-copy` left, `.home-globe` right), so the hero globe stays mounted and never reloads.
- **What the globe does:** it flies to the place the question is about, and arcs draw in from where the reporting comes from (owner's pick "watch the sweep"). At any time you can drag it, and a readout names the place under your cursor (owner's pick "free roam").
- **Progress is real:** it streams from the backend, never from timers.
- **Ready means go:** when the briefing is ready, the app goes straight to `/brief/:id`, even mid-drag. There's no "ready, click to open" step.
- **Entrance:** the elements move into place, and the ledger's rows and text **drop down** into place one after another. There's no fan-out or morph beyond that.

Reference mockups: `.superpowers/brainstorm/20862-1792688438/content/loading-layout.html` (option A) and `transition-storyboard.html`. They're git-ignored scratch, so this description is the binding one. Where it differs from the storyboard (the storyboard showed provenance labels fanning out), this text wins.

### The screen

**Left column (the ledger), top to bottom:**

- **The kicker** "Preparing your briefing" (label style).
- **The focus phrase** as the heading (Plex 600, the size of Home's ask text or larger; the builder picks).
- **Stage rows** divided by `--rule` hairlines. The row in progress is `--accent`, finished rows are `--ink` and waiting rows are `--ink-3`:
  1. **Plan:** "Sudan · 5 queries". With no place, it reads "5 queries".
  2. **Sources:** "6 of 9 sources in · 214 articles from 63 outlets". Under it is a two-column grid with one line per source that runs: its label and article count, "…" while it's pending, "no results", or "timed out". The newsroom feeds bundle is one line: "Newsroom feeds 62".
     - **M comes from the `plan` event's `sources` list** (designer's call): the honest count for this run, 9 for a general question and 10 for a finance one. It does not come from `/sources`.
     - **The unit is "sources",** where the newsroom-feeds bundle counts as one. The lede and provenance row count "news services" and "newsroom feeds" separately. These are different units, each labelled, so "8 news services" on Home and "of 9 sources" here do not conflict. The anti-goal is about the *same* unit disagreeing.
  3. **Remove duplicates, rank:** "214 → 58 kept".
  4. **Write:** developments, signals and alerts, each ticking off as it lands. Once all three have landed, the row reads "Adding context and photos…" until the briefing arrives.
- **A "Cancel" text control** at the bottom. It aborts the request and returns to Home.

**Right column:** the same globe that was on Home.

- **Before the plan:** the globe keeps turning at scanning speed, as it does today.
- **On the plan event:** if the plan names a place (see "The place" below) and it resolves through `resolveRegion`, the globe flies there (`focusOn`) and a marker pulses on it. If not, the globe keeps turning and nothing is guessed.
- **On the newsroom feeds' source event:** for each feed outlet that returned articles, an arc draws from that outlet's home city to the target, in `--accent`.
  - Home cities come from a new constant table, `FEED_CITIES`, with one HQ city per distinct outlet (23), keyed so that every feed of an outlet maps to it. NYT's three feeds draw one arc from New York, not three.
  - Aggregator and search services have no home city. They appear only in the ledger and never draw arcs.
  - With no target, the contributing outlets' cities light up as hotspots instead of arcs.
- **The readout** keeps working the whole time: drag, the existing momentum, and the pointer readout.
  - **The readout gets richer:** "Eritrea · 14:32 local · 15.5° N 41.8° E".
  - **Place name (designer's call):** the nearest *country* within about 800 km, from a curated readout table. That table is the country entries of `centroids.ts`, deduplicated by alias, so "burma" and "myanmar" become one entry. Blocs and abstractions (`nato`, `eu`, `global south`) and supranational regions are excluded, because a readout must name a place on the ground. Over open ocean it shows coordinates only.
  - **Local time:** only for countries with a single time zone, from a new country → IANA zone table. Multi-zone countries (US, Russia, Canada, Brazil, Australia, Indonesia, Mexico, Kazakhstan and the like) show no local time. A guessed time is worse than none.
- **Hint line** under the globe: "Drag to look around. Your briefing opens when it's ready."

**Cold start:** if no event has arrived after 8 seconds, the Sources row area shows the existing honest note: "Waking the backend. Free hosting sleeps when idle, so this can take up to a minute…". The 0s and 25s timed messages in `AskForm` go away. The ledger replaces them.

### Transition in and out

- **In:** about 700 ms total, on submit from the ask box or a wire line.
  - Headline, lede, ask box, wire, provenance and the contour lines fade out and drop away.
  - The typed phrase moves up into the heading slot. Builder's choice of how: a FLIP of the input text into the heading, or a fade-up in place. It must read as the same words moving.
  - The globe stays put and grows a little.
  - The ledger's kicker, heading and stage rows drop down into place, staggered top to bottom. Each one comes in from a few px above with opacity 0 → 1.
- **Out:** navigate to `/brief/:id` as soon as the final event lands. No exit animation is required.
- **A cached briefing that returns instantly** navigates immediately, even mid-entrance.
- **Reduced motion:**
  - **Swaps:** a single short crossfade (opacity only), with no drop-down, no fly and no arc-draw animation.
  - **Globe:** under reduced motion it already doesn't spin. Here it jumps to the target, and arcs appear fully drawn.

### Routing, cancel, errors

- **URL:** the loading screen is a state of `HomePage`, not a new route. Rendering it inside `HomePage` is what keeps the globe mounted.
- **Back:** while loading, the browser's Back button cancels, the same as the Cancel link, and returns to Home. The builder picks the mechanism, for example pushing a history entry on submit and aborting on `popstate`. After a cancel, Back must not leave a dead entry behind.
- **Success:** navigation to `/brief/:id` replaces the loading entry, so Back from the briefing goes to Home, not to a stale loading screen.
- **Errors:** any error, whether an HTTP error, an error event, a network drop or the 120 s timeout, returns to Home with the message in `AskForm`'s existing error area, with Retry, exactly as today.

### No-WebGL

The ledger is identical. The right column shows `StaticGlobe` with no flight, arcs or readout.

### Phone width

Below 980px the globe goes above the ledger at reduced height, the same breakpoint Home and the Story tab use, and the ledger follows below it. Drag still works on touch, with the readout updating while you drag.

### The streaming endpoint

`POST /briefing/stream` takes the same request body and the same `X-Turnstile-Token` header. It returns `application/x-ndjson` with one JSON object per line. Headers are `Cache-Control: no-cache` and `X-Accel-Buffering: no`.

- **Up-front checks:** rate limiting, Turnstile and the budget run before streaming starts, and they fail as ordinary HTTP errors with the same codes and `detail` text as `/briefing`.
- **Cache hits:** the stream emits only the final `briefing` event.

Events, in the order they can occur:

| `type` | Fields | When |
|---|---|---|
| `plan` | `place` (str or null; see "The place"), `queries` (int), `is_finance` (bool), `sources` (list of source names that will run) | After `plan_search` |
| `source` | `name`, `count`, `status` (`ok`/`empty`/`timeout`/`error`/`deadline`), `outlets` (object outlet → count; for RSS this drives the arcs) | As each source finishes. Deadline-cancelled ones arrive together at the deadline. |
| `ranked` | `merged`, `deduped`, `kept`, `outlets` (distinct outlets among the merged articles) | After dedupe and rerank |
| `section` | `name` (`developments`/`signals`/`alerts`) | As each synthesis section lands |
| `briefing` | `briefing` (the exact `Briefing` JSON `/briefing` would return) | Last, on success |
| `error` | `status` (the HTTP code `/briefing` would have used), `detail` | Last, on failure after streaming began |

**Backend shape:**

- **One pipeline, two endpoints:** move the body of `briefing_endpoint` into one pipeline function with an optional async `emit(event)` callback. `/briefing` calls it with no callback and behaves byte-for-byte as today, including the cache, logging, `enforce_url_allowlist` and the error texts. `/briefing/stream` passes a callback that feeds an `asyncio.Queue` drained by a `StreamingResponse` generator.
- **`ingest()`:** gains an optional `on_source` callback, fired as each task completes, keeping today's deadline and cancel behaviour.
- **`synthesize_briefing()`:** gains an optional `on_section` callback.
- **Callback failures:** a failing callback must never fail the briefing. Log and continue.
- **Client disconnects:** if the client disconnects, the pipeline is allowed to finish and fill the cache. The builder may cancel instead if that's simpler, but must say which in the notes.
- **Error mapping:** the stream maps the pipeline's `HTTPException`s to an `error` event with the same `status` and `detail`.

**The place (designer's call).** The globe's target is a new optional `SearchPlan.place`: the English name of the single country or region the story is *about* ("Sudan", "Iran", "Strait of Hormuz"), or null when there isn't one ("chip export controls"). It is separate from `country` and doesn't change `country`'s meaning or its use as a search filter.
- **How it's set:** the existing Haiku planning call returns it, as one more JSON field in the same call, so it adds no latency.
- **The rules fallback** (`rule_plan`, or when Haiku omits the field): the backend scans the focus phrase for a known place name. It uses a small server-side name list (country names plus the common regions and straits); the builder may generate this from `centroids.ts`.
- **On the client:** the frontend resolves `place` through `resolveRegion`. If that fails, it tries `resolveRegion` on the focus phrase's words and two-word runs before giving up.
- **Tests:** add cases to the search-plan tests for subject places ("Sudan's ceasefire talks" → "Sudan"), place-less topics (→ null), and that `country` is unchanged.

**Frontend client:**

- **The request:** `requestBriefingStream(focus, signal, onEvent)` in `lib/api.ts` reads `res.body` with a reader and splits it on newlines. A JSON line can arrive split across chunks, and several can arrive in one chunk.
- **Its result:** it resolves with the final `ApiBriefing`.
- **The fallback:** `useGenerateBriefing` uses the stream first. If the stream endpoint answers 404 or 405, or the body isn't readable as a stream, it falls back once to today's `requestBriefing`. The ledger then shows only the cold-start note and "Working…" states, with no fake progress.
- **Buffering:** if a proxy buffers the stream and every event arrives at once, the result is still correct. The ledger simply fills in at the end.
- **The hook's new return value:** `useGenerateBriefing` exposes the ledger state (a reducer over the events) alongside `loading` and `error`, plus a `cancel()`.

## Piece 2: the value-prop lede

The rotating headline is unchanged. The text of `p.home-lede` changes to this. The owner picked the direction ("confident and precise") from three drafts. This is draft C, and the exact wording is open to the owner's edits while they read the spec:

> Know what changed, where it happened, and who disagrees. Atlas reads across **eight news services and 26 newsroom feeds** and writes a cited briefing for analysts, writers and anyone who follows world events seriously.

- **"Know what changed, where it happened, and who disagrees"** keeps `<em>`, the same as today's lede.
- **The two numbers** come from `GET /sources`: enabled non-finance services excluding the RSS bundle (8 today), and the feed count (26).
  - **Style:** numbers one to nine are spelled out, and 10 and up are digits.
  - **On first paint:** use the last value cached in `sessionStorage`, the same pattern as `lib/trending.ts`. With no cached value, render the numberless version: "Atlas reads across a range of news services and newsroom feeds…". Never print a hard-coded number.

## Piece 3: explaining the sources

The owner picked **option B**: a short provenance row plus a new section lower on Home.

**Provenance row:** it stays where it is, as label-style spans.

- **New contents:** "8 news services · 26 newsroom feeds · Model-written, source-cited", plus a "How Atlas reads ↓" link to `#how-atlas-reads`.
- **Before `/sources` loads:** with no count yet, the first two spans read "News services" and "Newsroom feeds", following the same rules as the lede.
- **The link:** it scrolls to `#how-atlas-reads`, smoothly only under `prefers-reduced-motion: no-preference`.

**New section `section#how-atlas-reads`,** after the hero (`.home-inner`) and before the footer, inside Home's page:

- **Label and title:** a label-style kicker, "How Atlas reads the news", under an `--ink` top rule, then a title such as "Eight news services, 26 newsroom feeds, one briefing." built from the same live numbers. Never "26 newsrooms": the feeds come from 23 outlets. The builder sets the exact title wording within that pattern.
- **Three short points** in a three-column grid that stacks below 980px:
  - **Breadth:** "Aggregators like GDELT and Google News reach tens of thousands of outlets, so regional and local reporting gets in, not just the big wires."
  - **Corroboration:** "The same event reported by many outlets is merged once and ranked higher."
  - **Disagreement:** "Where outlets contradict each other, the briefing shows both accounts side by side."

  The builder may tighten the wording but must keep every claim true to the pipeline.
- **The source list:**
  - Every service, with enabled ones in `--ink` and disabled ones in `--ink-3`, marked "off".
  - Finance services under a "Finance questions add" line.
  - The newsroom feeds as one line naming the outlets, deduplicated by outlet: "BBC, Al Jazeera, DW, France 24, The Hindu, AllAfrica, Straits Times, …". The builder picks how many to name before "…".
- **Style:** Newsprint tokens only, with no new colours, fonts or animation. Red and amber are not used.
- **If `/sources` fails:** the section still renders the three points, and the list falls back to the static names in the frontend constant, without on/off states or counts.

### `GET /sources`

```json
{
  "services": [{ "name": "gdelt", "label": "GDELT 2.0", "enabled": true, "finance_only": false }],
  "feeds": { "count": 26, "outlets": ["BBC", "Al Jazeera", "..."] }
  // count = number of feeds (what Home prints); outlets = the 23 distinct outlets, collapsed
}
```

- **What it lists:** `services` covers every registry source except RSS, which is described by `feeds`.
- **Labels:** each source module gains a `SOURCE_LABEL` display name, and `source_from_module` reads it. Update CLAUDE.md's "Adding a source" line to match.
- **Outlet names:** feed outlet names collapse sub-feeds, so "New York Times World", "New York Times U.S." and "New York Times Technology" become "New York Times". The builder picks the rule, either an explicit map or stripping known section suffixes.
- **Cost and caching:** no LLM and no network calls. It's computed from config and cacheable in memory.
- **Shared data:** the frontend fetches it once per session for the lede, the provenance row, the section and the ledger's "N of M", all sharing one cached value.

## Goals

1. Submitting a briefing takes over Home with the ledger and the same globe. Real progress streams in, the globe flies to the place and draws arcs from contributing newsrooms, and it opens the briefing the moment it's ready.
2. The globe is playable throughout: drag, momentum, and a readout that names the place and, where it can be precise, its local time.
3. The lede says what Atlas does and who it's for, in a confident, precise register.
4. Every source number on Home is computed from the live server configuration.
5. Home explains what the sources are and why breadth, corroboration and disagreement matter.
6. `/briefing` keeps working unchanged as the fallback.

## Non-goals

- The Hotspots tab, intensity markers or a flat map (project 4).
- Commons fallback for failed outlet photos.
- New news sources, or setting the missing keys (Brave and the rest). Those are the owner's job on Render.
- Streaming partial briefing content, such as showing developments before the briefing is done. Only progress streams.
- Rewriting the root README's stale source list. The builder may fix it in one line if they touch it anyway.

## Anti-goals (a failure even if it technically works)

- **Fake progress:** any stage, count or arc not caused by a real event. Timers may only produce the cold-start note.
- **A spinner in disguise:** a screen where nothing happens for 20 seconds while the backend is awake.
- **A remounted globe:** a visible reload or flash of the globe between Home and the loading screen.
- **Wrong numbers:** any hard-coded source count, or a count that disagrees between the lede, the row, the section and the ledger.
- **Guessed precision:** a local time or place name that is guessed, such as a longitude-based time for China or the US.
- **A dead end:** a loading screen with no way out, or a Back button that strands the person.
- **Breaking the identity:** new colours or fonts, red or amber used for non-heat, or motion that ignores reduced motion.

## Tests

**Backend (pytest):**

- **Stream success:** with fake sources and fake synthesis, `/briefing/stream` emits `plan`, one `source` per active source, `ranked`, three `section`s and `briefing`, in a valid order. The `briefing` payload equals what `/briefing` returns for the same input.
- **Up-front failures:** rate limit, Turnstile and budget failures return the same HTTP status and detail as `/briefing`, with no stream.
- **Failures mid-stream:** "no articles" (502), "no match" (422) and synthesis failures produce a final `error` event with `/briefing`'s status and detail.
- **Cache hit:** emits only `briefing`.
- **Callback safety:** a raising `emit` doesn't fail the pipeline.
- **`ingest`:** `on_source` fires once per active source, including deadline-cancelled ones.
- **`/sources`:** lists every non-RSS registry source with `enabled` matching `enabled()`, collapses feed outlets, and reports `count == len(RSS_FEEDS)`.
- **Existing `/briefing` tests** pass unchanged.

**Frontend (vitest):**

- **NDJSON parser:** lines split across chunks, several lines in one chunk, and a trailing line with no newline.
- **Ledger reducer:** each event type, the "N of M" counts, the tally text, and the cold-start note after 8 s with no events.
- **Fallback:** a 404 from the stream falls back to `requestBriefing` exactly once.
- **Cancel and Back:** both abort and return to Home. Success navigates with replace.
- **Readout:** the nearest country within the radius, never a bloc ("NATO" over Germany must not happen), coordinates only over open ocean, and local time only for single-zone countries.
- **Numbers:** the formatting rule (spelled out under 10), the numberless fallback before `/sources` loads, and the session-cache first paint.
- **Reduced motion:** the loading screen applies no drop-down or fly classes.
- **Existing tests** stay green, and `npm run build` and `npm run lint` are clean.

## Left to the builder

- How the phrase moves into the heading (FLIP or fade-up), within the "reads as the same words" rule.
- Whether hero mode accepts arcs and a focus target directly or gains a `'loading'` mode in `GlobeView`, as long as the instance isn't remounted.
- The `FEED_CITIES` HQ choice per outlet. AllAfrica, for example, has offices on two continents; pick one and note it.
- How the feed outlets are named and how many are listed.
- The Back-button mechanism.
- Whether a client disconnect cancels the pipeline (see the endpoint section).
- The exact ledger copy for source statuses, within the tone of the examples.

## Done when

- **Locally (backend :8000, frontend :5180):**
  - A briefing on a warm backend shows the ledger filling stage by stage in real time.
  - The globe flies to the focus country and draws arcs from contributing newsrooms.
  - The briefing opens on its own the moment it's ready.
  - The same flow works with reduced motion on (crossfade, no animation) and with WebGL off (`StaticGlobe`).
- **Fallback:** forcing `/briefing/stream` to 404 still produces a briefing through `/briefing`.
- **Numbers:** the lede, the provenance row, the section and the ledger all show the same live counts, and turning a key off in `.env` changes all four.
- **Tests and checks:** all of the above tests pass, plus `npm run build` and `npm run lint`.
- **Notes:** the spec's notes list any deviations.
- **After the owner merges and deploys:** check one live briefing to confirm that Vercel's rewrite to Render passes the stream through unbuffered. If it buffers, the fallback behaviour above is acceptable, and the fix becomes a follow-up, not a blocker.
