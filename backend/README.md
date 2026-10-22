# Backend — Global Briefing Generator

FastAPI service that turns a single focus phrase (e.g. `"South Asian security"`) into a structured
daily intelligence briefing synthesized from NewsAPI, GDELT, and curated RSS feeds.

## Architecture (6 layers)

1. **Input** — `POST /briefing` with `{"focus": "..."}`.
2. **Plan** — `search_plan.py` turns the focus into a `SearchPlan` (queries, must-terms, synonyms, coverage country, domains, tickers) with Claude Haiku, falling back to deterministic rules.
3. **Ingestion** — `ingestion/registry.py` runs every enabled source in parallel (6 s per source, 7 s overall; GDELT 4 s), each guarded by a daily quota: NewsAPI, GDELT, curated RSS (world, US, tech and finance desks), Google News RSS search, The Guardian, GNews, NewsData.io, Brave News, Tavily, Exa, and — for finance topics only — Finnhub, Marketaux and Alpha Vantage.
4. **Processing** — exact URL/title dedupe (`processing/urls.py`), embedding dedupe, a candidate pre-filter, and a Claude Haiku relevance rerank (`processing/rerank.py`) with the keyword + TF-IDF filter as fallback.
5. **Synthesis** — `synthesis/briefing.py` makes three parallel section calls on the synthesis model
   (Claude Sonnet 4.6): key developments, signals (emerging tensions, contradictions, recommended
   readings) and priority alerts. As soon as developments exist, `synthesis/context.py` fans out per
   key development to Claude Haiku 4.5 for short historical-context paragraphs, and
   `synthesis/commons.py` attaches Wikimedia Commons file photos. Once developments and signals both
   exist, one Haiku call (`synthesis/links.py`, 6 s budget) maps each tension and contradiction to the
   developments it concerns. A failure there leaves `related_developments` null and never fails the
   briefing.
6. **Output** — a `Briefing` object (see `models.py`) returned as JSON to the frontend.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in real keys
```

Keys in `.env` (all optional except Anthropic for real synthesis):

| Variable | Where to get it | Free tier |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | paid usage |
| `NEWSAPI_KEY` | newsapi.org | 100/day, 24 h delay, development plan |
| `GUARDIAN_API_KEY` | open-platform.theguardian.com | 5,000/day |
| `GNEWS_API_KEY` | gnews.io | 100/day, 12 h delay, non-commercial |
| `NEWSDATA_API_KEY` | newsdata.io | 200 credits/day |
| `BRAVE_API_KEY` | brave.com/search/api | ~$5 monthly credit (card required) |
| `TAVILY_API_KEY` | tavily.com | 1,000 credits/month |
| `EXA_API_KEY` | exa.ai | $10 monthly credit |
| `FINNHUB_API_KEY` | finnhub.io | 60 calls/min |
| `MARKETAUX_API_KEY` | marketaux.com | 100/day |
| `ALPHAVANTAGE_API_KEY` | alphavantage.co | 25/day |

GDELT, the RSS feeds and Google News RSS search need no key. Daily request budgets per source are configurable with `QUOTA_<SOURCE>_PER_DAY` (see `config.py`).

## Run

```bash
uvicorn backend.main:app --reload --port 8000
```

Run from the repo root (matching `render.yaml`).

Then:

```bash
curl -s -X POST http://localhost:8000/briefing \
  -H "Content-Type: application/json" \
  -d '{"focus":"South Asian security"}' | jq
```

Health check: `GET /health`.

Trending topics for Home: `GET /trending` → `{topics, generated_at}`. Google News top stories grouped by Haiku into up to 6 short topics, cached for `TRENDING_TTL_MINUTES` (default 60). Without an Anthropic key, or on any failure, `topics` is empty and Home keeps its fixed chips.

## Tuning

All knobs live in `.env` / `config.py`:

- `MAX_ARTICLES_PER_SOURCE` (default 15)
- `DEDUP_SIMILARITY_THRESHOLD` (default 0.85 cosine)
- `RELEVANCE_SIMILARITY_THRESHOLD` (default 0.30 cosine vs. focus embedding; used only by the fallback ranker when Haiku rerank is off or fails)
- `HOURS_LOOKBACK` (default 24)
- `RATE_LIMIT_PER_MINUTE` (default 6): per-client cap on `POST /briefing`, keyed on the right-most `X-Forwarded-For` hop (the one the platform proxy adds; earlier entries are client-controlled)
- `BRIEFING_BUDGET_PER_HOUR` / `BRIEFING_BUDGET_PER_DAY` (defaults 20 / 100): cap on new, uncached briefings across all clients. This is what bounds API spend; cached briefings don't count. 0 disables a window
- `TURNSTILE_SECRET_KEY`: when set, `POST /briefing` requires a Cloudflare Turnstile token in `X-Turnstile-Token` (403 without a valid one; let through if Cloudflare is unreachable). Set the frontend's `VITE_TURNSTILE_SITE_KEY` first
- `COMMONS_IMAGES_ENABLED` (default true): attach Wikimedia Commons file photos to developments and alerts during synthesis (cached 24 h; failures only logged)
- `EXPOSE_DOCS` (default false): publish `/docs`, `/redoc` and `/openapi.json`

## Response shape

See `models.Briefing` — the frontend should render:

- `key_developments[]` — headline + analytical summary + sources + `historical_context`, plus an optional `place` (`{name, country, lat, lng}`) when the story names a city and an optional `commons_image` (a Wikimedia Commons file photo with author and license)
- every source citation may carry an optional `image_url` (https only, from the 8 sources that supply images)
- `emerging_tensions[]` — each with `related_developments`: zero-based indexes into `key_developments`, or null when the link call failed
- `contradictions[]` — two competing accounts with separate source lists, plus `related_developments` as above
- `priority_alerts[]` — severity `critical | high | elevated` (render red for the first two); may carry a `commons_image`
- `recommended_readings[]`
- `article_count`, `source_breakdown` — telemetry for the footer

## Data

`data/cities.csv` lists the ~6,300 cities with population ≥ 100,000, used by `places.py` to turn the model's `"City, Country"` into coordinates (the model never supplies coordinates). Regenerate it with `.venv/bin/python backend/scripts/build_cities.py`.

City data © GeoNames ([geonames.org](https://www.geonames.org/)), licensed under CC BY 4.0.
