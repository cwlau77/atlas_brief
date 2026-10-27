# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Atlas: one focus phrase in, a synthesized news briefing out (key developments, tensions, contradictions, alerts, readings) plotted on a 3D globe. Python FastAPI backend (`backend/`) plus a Vite/React/TypeScript SPA (`frontend/`). There is no database; user state lives in `localStorage` via `frontend/src/lib/storage.ts`.

## Commands

Backend (Python 3.11, run from the repo root; `render.yaml` assumes this):

```bash
python -m venv .venv && .venv/bin/pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
.venv/bin/python -m pytest backend/tests -v
.venv/bin/python -m pytest backend/tests/test_rerank.py::test_name -v   # single test
```

`DEMO_MODE=true` runs without an Anthropic key (keyword-fallback briefings only).

Frontend (from `frontend/`):

```bash
npm run dev        # proxies /api/* to 127.0.0.1:8000
npm run dev:live   # proxies /api/* to the live Render backend
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npx vitest run     # all tests
npx vitest run src/lib/storage.test.ts   # single file
```

## Architecture

**Backend pipeline** (`backend/main.py` orchestrates `POST /briefing`):
`search_plan.py` (focus → `SearchPlan`: queries, must/synonym terms, country, domains, tickers; Claude Haiku with a deterministic `rule_plan` fallback) → `ingestion/registry.py` (runs every enabled source in parallel with per-source timeouts, daily quotas via `ingestion/quota.py`; a failing source never fails the briefing) → `processing/` (exact URL dedupe, embedding dedupe, Haiku relevance rerank with TF-IDF threshold as fallback) → `synthesis/briefing.py` (parallel section calls on `synthesis_model`, Haiku by default, structured JSON: developments, signals, alerts, plus the optional outlook). As soon as the developments exist, `synthesis/context.py` (per-development Haiku historical context) and `synthesis/commons.py` (Commons file photos) start. Once the signals exist too, `synthesis/links.py` makes one Haiku call that sets `related_developments` on tensions and contradictions; it has a 6s budget, and on failure it leaves the field `None` without failing the briefing. The outlook section (`trends`, `implications`: `models.OutlookItem`) is a fourth call on `outlook_model` (Haiku) that never holds the briefing up: once everything else is done it gets `OUTLOOK_GRACE_S` (3s), then it is dropped. An item stays `reported` only when its quote is found in a cited article's title or snippet (`_parse_outlook`); otherwise it is Atlas's own `assessment`. `link_outlook` in `links.py` (waits on developments and outlook, not signals) plus a shared-citation fallback sets `related_developments`; `settle_outlook` drops assessments linked to nothing, and `enforce_url_allowlist` re-applies it. Key figures are a fifth optional call (`figures`, on `figures_model`, Haiku; `KEY_FIGURES_ENABLED` turns it off) that starts with the others, emits no progress event and shares outlook's grace window. `_parse_figures` keeps a figure only when it is found word for word, as a whole number with its unit, in the cited article's title or snippet, and puts back a dropped hedge ("around", "below"). `attach_figures` puts each one on one development that cites its article (at most three per card), and `enforce_url_allowlist` drops a figure whose article its card no longer cites. All LLM calls go through `backend/llm.py`; JSON parsing through `llm_json.py`. Response shape is `models.Briefing`. `POST /briefing/stream` runs the same pipeline (`main._run_pipeline`) with an `emit` callback and writes NDJSON progress events (`plan`, `source`, `ranked`, `section`, then `briefing` or `error`); `/briefing` is the fallback. The plan's `place` (the story's subject, for the globe) is separate from `country` (a coverage filter).

- **Adding a source:** create `ingestion/<name>_source.py` exposing `SOURCE_NAME`, `SOURCE_LABEL` (display name, shown by `GET /sources`), `fetch`, `enabled` (and optionally `FINANCE_ONLY`), build articles with `make_article` from `ingestion/common.py`, then add the module to the `SOURCES` tuple in `registry.py`. Add its key to `config.py` and `.env.example`.
- **Single-process assumption:** the briefing cache, per-IP rate limiter and GDELT pacing are all in-memory, so the backend must stay one long-running process (Render). Don't move it to serverless.
- Some sources must send API keys as query params, so `httpx`/`httpcore` loggers are pinned to WARNING in `main.py`. Keep it that way so keys never reach logs.
- The relevance threshold (0.30) is validated against `backend/tests/fixtures/relevance_pairs.py`; changing it means re-checking that fixture.

**Frontend:** the browser only calls `/api/*`; `frontend/vercel.json` rewrites it to the Render URL in prod and the Vite proxy does so in dev. Routes are in `src/routes/` (plain `react-router`, no data router). Shared state is `src/state/AppState.tsx` (functional updaters; persistence happens outside the updaters). The globe is custom three.js, not globe.gl: `globe/engine.ts` owns the renderer, `GlobeView.tsx` is the lazy wrapper, `StaticGlobe.tsx` is the no-WebGL fallback. While a briefing generates, Home swaps its copy for `components/LoadingLedger.tsx` (a reducer over the stream's events in `lib/ledger.ts`, from `useGenerateBriefing`) and passes the same mounted hero globe a `loading` prop (fly to the place, arcs from `globe/feedCities.ts`); a pushed history entry makes Back cancel. `globe/landPoints.ts` is generated; re-run `npm run build:land` only after upgrading `world-atlas`. Design tokens live only in `src/styles/tokens.css`. All motion must respect `prefers-reduced-motion`.

**Story tab** (`src/routes/StoryTab.tsx`): Read first alert cells (only when there are alerts), then `section#key-developments` with the newest-first timeline and, below it, the tension index on the left, and a sticky globe on the right that follows card and index-row hover (`globe/follow.ts`; above the timeline and not sticky below 980px), then Top stories and the reading list. Index rows link to developments via `related_developments` (zero-based indexes); `linkBriefing` in `lib/timeline.ts` falls back to region-name matching only when that field is `null`, and treats `[]` as "linked to nothing". Each row states the relationship in words: tensions carry an optional `relationship` enum from synthesis (`models.Tension`; the shown phrases live only in `RELATIONSHIP_LABELS` in `lib/tensionIndex.ts`, unknown values show nothing), contradictions a fixed phrase. Actors are joined as words; older saved briefings store `A ↔ B`, read through `actorsText` in `lib/normalize.ts`. A row's "Ties to" list names its linked developments and jumps to them; a card's connection tag pins its row and scrolls to it. Region-tag clicks, story jumps and "Ties to" jumps (`scrollToStory`) send the globe a one-off `{ dev, seq }` request in `follow.ts`. A request wins over hover and focus until a newer intent replaces it: a 250ms dwell on another card, keyboard focus on another card, a pin or preview change, or the carousel opening. Under its summary a card lists its Key figures (`components/briefing/KeyFigures.tsx`): the verbatim figure, what it measures and a dated link to its article. `lib/keyFigures.ts` groups comparable figures (same kind and unit) into ink bars on one scale from zero, or 0–100% meters for shares; it parses numbers only for bar length, never for display, and limits like "below 10%" are listed but never charted. Card images come from `lib/cardImage.ts` (`cardImages`): every distinct outlet photo in citation order, then a Wikimedia Commons "File photo"; `CardImage` and `StoryCard` fall through the list as images fail to load. `backend/synthesis/commons.py` attaches a Commons photo to every development and alert during synthesis (photo-less items pick first; 1.5s budget, in-memory 24h cache, overrunning lookups finish in the background to fill it; failures only logged).

## Deployment gotchas

- Vercel's **Root Directory must be `frontend`**; otherwise the root `requirements.txt` makes Vercel treat the project as Python and the build fails.
- The Render service was created as a manual Web Service, not a Blueprint, so `render.yaml` env vars are not applied. `PYTHON_VERSION=3.11.11`, `ANTHROPIC_API_KEY`, `NEWSAPI_KEY` and `ALLOWED_ORIGINS` must be set in the dashboard by hand. Other settings fall back to defaults in `backend/config.py`.

## Docs and stale spots

- `docs/BACKLOG.md` is the idea backlog; specs and plans are in `docs/superpowers/`, shipped plans in `docs/archive/`.
- The identity is **Newsprint & Ultramarine**: paper `#F5F5F1` and ink `#0E1116`, with ultramarine `--accent` (`#1F3FE0`) as the single highlight. Red and amber are reserved for heat (priority, alerts). IBM Plex Sans is the only type family. All tokens live in `frontend/src/styles/tokens.css`. The root README still says "9 regional RSS wires" and "NewsAPI, GDELT" only; `backend/README.md` has the accurate 13-source list. Trust the code and `tokens.css` over READMEs.
- `.agents/` and `.claude/skills/` hold vendored Higgsfield skills (`skills-lock.json`); they are tooling, not app code.
