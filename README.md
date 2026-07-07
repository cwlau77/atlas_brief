# Atlas Brief

Global news intelligence for time-constrained readers: one focus phrase in, a
synthesized briefing out — key developments with historical context, emerging
tensions, cross-source contradictions, priority alerts, and recommended
reading, plotted on an interactive 3D globe.

## Architecture

```
Browser ── Vercel (static Vite/React build)
              │  rewrite /api/* ─────────────┐
              ▼                              ▼
        frontend/dist                 Render (FastAPI, long-running)
                                             │
                     ┌───────────────────────┼──────────────────────┐
                     ▼                       ▼                      ▼
                  NewsAPI              GDELT DOC 2.0        9 regional RSS wires
                     └───────────────────────┴──────────────────────┘
                                             │
                     local TF-IDF embed → dedup → relevance filter
                                             │
                          Claude Haiku synthesis + historical enrichment
```

- **Split deploy.** The frontend is a static Vercel build; the backend stays a
  single long-running Render process. That keeps the in-memory briefing cache
  and per-IP rate limiter valid, and lets all GDELT calls be paced from one
  process (GDELT allows ~1 request per 5s per IP).
- **Same-origin API.** The browser only ever calls `/api/*`; `vercel.json`
  rewrites that to the Render URL in production and the Vite dev proxy does the
  same locally. CORS is pinned via `ALLOWED_ORIGINS` as a backup layer.
- **No database.** User state (profile, settings, archived briefings, stars)
  lives in guarded `localStorage` behind `frontend/src/lib/storage.ts`, using
  the same keys as the original app so existing data survives.

## Local development

Backend (Python 3.11):

```bash
python -m venv .venv && .venv/bin/pip install -r backend/requirements-dev.txt
cp backend/.env.example backend/.env   # add ANTHROPIC_API_KEY / NEWSAPI_KEY
.venv/bin/python -m uvicorn backend.main:app --port 8000
```

Frontend (Node 24):

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api → :8000
```

No Anthropic key? Run the backend with `DEMO_MODE=true` to get keyword-matched
fallback briefings (clearly inferior — no real analysis, no contradictions).

## Tests

```bash
.venv/bin/python -m pytest backend/tests -v   # 34 tests: ingestion, dedup, relevance, synthesis, API contract
cd frontend && npx vitest run                 # 18 tests: storage, normalization, centroids
```

The relevance threshold (`0.30`) is validated against a hand-labeled fixture
(`backend/tests/fixtures/relevance_pairs.py`) — recall 0.92 / precision 0.92.
Change the threshold and the suite will tell you what it costs.

## Deploy

**Backend (Render):** `render.yaml` is canonical. Set `ANTHROPIC_API_KEY` and
`NEWSAPI_KEY` in the dashboard; update `ALLOWED_ORIGINS` to the real Vercel URL
after the first frontend deploy. Free tier sleeps when idle — the frontend
warns users about the up-to-a-minute wake-up honestly.

**Frontend (Vercel):** import the repo and set the project's **Root Directory
to `frontend`** (Settings → Build & Deployment). This is required — the repo
root has a `requirements.txt` for Render, which otherwise makes Vercel
misdetect the whole project as a Python function and fail the build. With the
root set to `frontend/`, Vercel sees a plain Vite app and reads
`frontend/vercel.json` for the `/api/*` rewrite. **Verify the rewrite
destination matches your actual Render URL** (currently assumed to be
`https://guaihack-global-brief-gen.onrender.com`).

## Environment variables (backend)

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Synthesis + historical enrichment (503 without it unless demo mode) |
| `NEWSAPI_KEY` | — | NewsAPI ingestion (sent as `X-Api-Key` header) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `DEMO_MODE` | `false` | Allow keyword-fallback briefings without an Anthropic key |
| `RATE_LIMIT_PER_MINUTE` | `6` | Per-IP budget for `POST /briefing`; 0 disables |
| `GDELT_MIN_INTERVAL_SECONDS` | `5.5` | Process-global spacing between GDELT calls |
| `RELEVANCE_SIMILARITY_THRESHOLD` | `0.30` | Validated by the labeled test fixture |
| `SYNTHESIS_MODEL` / `CONTEXT_MODEL` | `claude-haiku-4-5` | Model overrides |
| `CACHE_TTL_MINUTES` | `15` | In-memory briefing cache per focus; 0 disables |

See `backend/.env.example` for the full list.
