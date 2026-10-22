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
`search_plan.py` (focus → `SearchPlan`: queries, must/synonym terms, country, domains, tickers; Claude Haiku with a deterministic `rule_plan` fallback) → `ingestion/registry.py` (runs every enabled source in parallel with per-source timeouts, daily quotas via `ingestion/quota.py`; a failing source never fails the briefing) → `processing/` (exact URL dedupe, embedding dedupe, Haiku relevance rerank with TF-IDF threshold as fallback) → `synthesis/briefing.py` (three parallel Sonnet section calls, structured JSON: developments, signals, alerts). As soon as the developments exist, `synthesis/context.py` (per-development Haiku historical context) and `synthesis/commons.py` (Commons file photos) start. Once the signals exist too, `synthesis/links.py` makes one Haiku call that sets `related_developments` on tensions and contradictions; it has a 6s budget, and on failure it leaves the field `None` without failing the briefing. All LLM calls go through `backend/llm.py`; JSON parsing through `llm_json.py`. Response shape is `models.Briefing`.

- **Adding a source:** create `ingestion/<name>_source.py` exposing `SOURCE_NAME`, `fetch`, `enabled` (and optionally `FINANCE_ONLY`), build articles with `make_article` from `ingestion/common.py`, then add the module to the `SOURCES` tuple in `registry.py`. Add its key to `config.py` and `.env.example`.
- **Single-process assumption:** the briefing cache, per-IP rate limiter and GDELT pacing are all in-memory, so the backend must stay one long-running process (Render). Don't move it to serverless.
- Some sources must send API keys as query params, so `httpx`/`httpcore` loggers are pinned to WARNING in `main.py`. Keep it that way so keys never reach logs.
- The relevance threshold (0.30) is validated against `backend/tests/fixtures/relevance_pairs.py`; changing it means re-checking that fixture.

**Frontend:** the browser only calls `/api/*`; `frontend/vercel.json` rewrites it to the Render URL in prod and the Vite proxy does so in dev. Routes are in `src/routes/` (plain `react-router`, no data router). Shared state is `src/state/AppState.tsx` (functional updaters; persistence happens outside the updaters). The globe is custom three.js, not globe.gl: `globe/engine.ts` owns the renderer, `GlobeView.tsx` is the lazy wrapper, `StaticGlobe.tsx` is the no-WebGL fallback. `globe/landPoints.ts` is generated; re-run `npm run build:land` only after upgrading `world-atlas`. Design tokens live only in `src/styles/tokens.css`. All motion must respect `prefers-reduced-motion`.

**Story tab** (`src/routes/StoryTab.tsx`): Read first alert cells (only when there are alerts), then `section#key-developments` with the tension index and newest-first timeline on the left and a sticky globe on the right that follows card hover (`globe/follow.ts`; above the timeline and not sticky below 980px), then Top stories and the reading list. Index rows link to developments via `related_developments` (zero-based indexes); `linkBriefing` in `lib/timeline.ts` falls back to region-name matching only when that field is `null`, and treats `[]` as "linked to nothing". Region-tag clicks and story jumps (`scrollToStory`) send the globe a one-off `{ dev, seq }` request in `follow.ts`. A request wins over hover and focus until a newer intent replaces it: a 250ms dwell on another card, keyboard focus on another card, a pin or preview change, or the carousel opening. Card images come from `lib/cardImage.ts`: the outlet's photo first, else a Wikimedia Commons "File photo" that `backend/synthesis/commons.py` attaches during synthesis (in-memory 24h cache, failures only logged).

## Deployment gotchas

- Vercel's **Root Directory must be `frontend`**; otherwise the root `requirements.txt` makes Vercel treat the project as Python and the build fails.
- The Render service was created as a manual Web Service, not a Blueprint, so `render.yaml` env vars are not applied. `PYTHON_VERSION=3.11.11`, `ANTHROPIC_API_KEY`, `NEWSAPI_KEY` and `ALLOWED_ORIGINS` must be set in the dashboard by hand. Other settings fall back to defaults in `backend/config.py`.

## Docs and stale spots

- `docs/BACKLOG.md` is the idea backlog; specs and plans are in `docs/superpowers/`, shipped plans in `docs/archive/`.
- The identity is **Newsprint & Ultramarine**: paper `#F5F5F1` and ink `#0E1116`, with ultramarine `--accent` (`#1F3FE0`) as the single highlight. Red and amber are reserved for heat (priority, alerts). IBM Plex Sans is the only type family. All tokens live in `frontend/src/styles/tokens.css`. The root README still says "9 regional RSS wires" and "NewsAPI, GDELT" only; `backend/README.md` has the accurate 13-source list. Trust the code and `tokens.css` over READMEs.
- `.agents/` and `.claude/skills/` hold vendored Higgsfield skills (`skills-lock.json`); they are tooling, not app code.
