# Broaden article retrieval: design spec

**Date:** 2026-10-17
**Status:** Approved in brainstorming, pending spec review
**Scope:** backend ingestion, query planning and relevance ranking; one frontend label change

## 1. Problem and intent

Briefings on major domestic topics come back nearly empty. "Data centers and privacy in the US" returned a single unrelated article.

**Root causes (verified by running `backend/focus_terms.py` on the phrase):**
1. `build_boolean_query` sends multi-word focuses with no rare "anchor" token upstream as one exact quoted phrase: `"data centers privacy us"`. NewsAPI and GDELT match almost nothing.
2. The 15 RSS feeds are all world-news desks; US domestic and tech coverage barely appears.
3. The keyword list includes the pronoun `us`; with the "2+ keyword hits" rule, an article containing "us" and "data" passes as relevant.
4. Relevance uses a TF-IDF hashing vectorizer, which cannot recognise synonyms ("hyperscale facility", "FTC data broker rule").

**Intent:** major topics return a full, relevant briefing drawn from many sources, at personal/portfolio traffic (light use), using only free tiers, without making briefings noticeably slower.

**Success criteria:**
- "Data centers and privacy in the US" returns ≥ 15 relevant articles from ≥ 4 distinct source types, and the synthesized briefing is about data centers and privacy.
- No regression on "South Asian security", "Regeneron", "Red Sea shipping" (same or better relevant-article counts; no off-topic noise in key developments).
- Uncached briefing latency grows by no more than ~8 s over today; total ingestion is bounded at 15 s.
- Existing labeled relevance test (precision ≥ 0.75, recall ≥ 0.85) stays green on the fallback path.

## 2. Approach (approved: "expand once, fan out, rerank")

```
focus ─► plan_search ─► SearchPlan ─► fan-out to all enabled sources (parallel, deadline)
                                         │
                       merge ─► normalize URLs ─► dedupe ─► pre-filter (≤ 60) ─► Haiku rerank (keep ≤ 25) ─► synthesis (unchanged)
```

Every LLM step has a deterministic fallback, so the pipeline still works with no Anthropic key or when Haiku is slow or failing.

## 3. Components

### 3.1 Search planning (`backend/search_plan.py`)

```python
class SearchPlan(BaseModel):
    phrase: str            # cleaned focus, e.g. "data centers privacy"
    queries: list[str]     # 1–3 search strings, most specific first
    must_terms: list[str]  # concepts a relevant article must touch, e.g. ["data center", "privacy"]
    synonyms: list[str]    # extra terms for keyword matching, e.g. ["hyperscale", "data broker"]
    country: str | None    # ISO-3166 alpha-2, e.g. "US"; None when not specified
    domains: list[Literal["finance", "tech", "politics", "general"]]  # topic areas; drives finance-source gating
    tickers: list[str]     # stock symbols when the focus names listed companies, e.g. ["NVDA", "MSFT"]; ≤ 5
    source: Literal["llm", "rules"]
```

`async def plan_search(focus: str) -> SearchPlan`:
- **LLM planner:** `claude-haiku-4-5` (configurable via `SEARCH_PLAN_MODEL`) through the existing `AsyncAnthropic` client, prompted to return JSON only; parsed with the existing `extract_json` helper and validated with the Pydantic model. Request timeout 4 s, `max_retries=0`, `max_tokens` 512. Output clamped: ≤ 3 queries, ≤ 4 must_terms, ≤ 8 synonyms, ≤ 5 tickers (A–Z, 1–5 chars, optional `.X` suffix), each string ≤ 80 chars; country upper-cased and validated as two letters; unknown domains dropped.
- **Rule planner (fallback and no-key path):**
  - Place qualifiers are extracted into `country` and removed from the phrase: "in the US", "U.S.", "US" (only when typed in capitals), "United States", "America"; "UK"/"United Kingdom"/"Britain"; "EU"/"European Union"; plus any country name in `centroids.py` matched as a trailing "in <country>".
  - The pronoun "us" (lowercase) is a stopword.
  - Pairing applies only when the focus has no curated topic head (`_TERM_ALIASES`) and no distinctive anchor token; those keep today's behavior. Otherwise, when the cleaned focus has 3+ content tokens, the first two form a quoted pair and the rest stay separate terms; e.g. `data centers privacy` → `"data centers" privacy`. With exactly 2 content tokens, both are kept as separate required terms (no exact-phrase requirement).
  - `must_terms`: the pair plus each remaining content token. Singular/plural variants are added for the pair ("data center", "data centers").
  - Existing behavior is preserved for single-word focuses (aliases from `_TERM_ALIASES`) and for entity names with a distinctive anchor token (e.g. "Regeneron Pharmaceuticals" → anchor "regeneron").
  - `queries`: `["\"data centers\" privacy", "\"data center\" privacy"]` style variants (≤ 3).
  - `domains`: `["finance"]` when the focus contains a finance cue (stock, stocks, shares, market, markets, earnings, IPO, bond, bonds, yields, Fed, interest rate, inflation, recession, crypto, bitcoin, ETF, merger, acquisition, dividend, Wall Street, S&P, Nasdaq, Dow) or a `$TICKER`; otherwise `["general"]`.
  - `tickers`: only explicit `$TICKER` tokens (the rule planner does not guess symbols from company names).
- Any LLM failure (timeout, API error, invalid JSON, empty queries) → rule planner. Logged once per request.

`build_boolean_query` in `focus_terms.py` is replaced by per-source query formatting from the plan (3.2); `extract_focus_terms` stays for the RSS/keyword fallback but gains the stopword and place-qualifier fixes.

### 3.2 Sources (`backend/ingestion/`)

Uniform contract per source module:

```python
SOURCE_NAME: str                       # e.g. "guardian"
def enabled() -> bool                  # key present (or keyless source)
async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]
```

`backend/ingestion/registry.py` lists all sources and runs `fetch` for each enabled one under `asyncio.wait_for(..., SOURCE_TIMEOUT_SECONDS)`, all inside an overall `INGEST_DEADLINE_SECONDS`. A source that raises, times out, returns non-2xx/429, or returns malformed data contributes `[]` and logs `source=<name> status=<reason>`; it never fails the request.

| Source (`raw_source_type`) | Key env var | Free tier (verified 2026-10-17) | Calls per briefing | Notes |
|---|---|---|---|---|
| NewsAPI (`newsapi`) | `NEWSAPI_KEY` (existing) | 100/day, 24 h delay, **development only** | 1 (OR of plan queries) | See §6 decision |
| GDELT (`gdelt`) | none | ~1 request / 5 s (existing pacing) | 1: best query + `sourcecountry:` when `country` set | Existing module, new query input |
| Curated RSS (`rss`) | none | n/a | feeds fetched once; keyword filter by must_terms/synonyms | Existing 15 world feeds + ~10 US/tech feeds (§3.3) |
| Google News RSS search (`google_news`) | none | unofficial; best effort | up to 3 (one per query) | `news.google.com/rss/search?q=<q>+when:7d&hl=en-<CC>&gl=<CC>&ceid=<CC>:en`, CC = plan country or US; polite User-Agent |
| The Guardian (`guardian`) | `GUARDIAN_API_KEY` | 5,000/day, ~12/s | up to 2 | Content API `/search`, `order-by=newest`, `from-date` = lookback, `show-fields=trailText` |
| GNews (`gnews`) | `GNEWS_API_KEY` | 100/day, 12 h delay, non-commercial, ≤ 10 articles/request | 1 | `country` param when set |
| NewsData.io (`newsdata`) | `NEWSDATA_API_KEY` | 200 credits/day (10 articles/credit), 30 credits / 15 min | 1 | `country` param when set |
| Brave News Search (`brave`) | `BRAVE_API_KEY` | ~$5 monthly credit (≈ 1,000 queries); free tier retired for new accounts Feb 2026, card required | 1 | `/res/v1/news/search`, `freshness=pw` |
| Tavily (`tavily`) | `TAVILY_API_KEY` | 1,000 credits/month | 1 | `topic=news`, `days=7` |
| Exa (`exa`) | `EXA_API_KEY` | $10 monthly credit (≈ 1,400 searches) | 1 | `category=news`, published within 7 days |
| Finnhub (`finnhub`) | `FINNHUB_API_KEY` | 60 calls/min, personal use | finance only: 1 market-news call (`/news?category=general`), plus 1 company-news call per ticker (≤ 3) over the lookback window | Market news has no query parameter, so results are keyword-filtered locally with must_terms/synonyms |
| Marketaux (`marketaux`) | `MARKETAUX_API_KEY` | 100 requests/day, 3 articles/request | finance only: 1 (`search=` best query, `symbols=` when tickers, `countries=` when country) | Low yield per call; used for its entity/sentiment-tagged finance coverage |
| Alpha Vantage (`alphavantage`) | `ALPHAVANTAGE_API_KEY` | 25 requests/day, 5/min | finance only: 1 `NEWS_SENTIMENT` call (`tickers=` when present, else `topics=` mapped from the plan, e.g. `economy_macro`, `financial_markets`, `technology`) | Lowest quota; never called for non-finance focuses |

**Finance gating:** Finnhub, Marketaux and Alpha Vantage run only when `"finance" in plan.domains` or `plan.tickers` is non-empty. Finance RSS feeds (§3.3) always run, since they are free and keyword-filtered.

Each module maps results to `Article` (title, snippet, url, source outlet, `published_at` as UTC-aware datetime when available, `country` when given, `raw_source_type`). `Article.raw_source_type` widens to the union of the names above.

### 3.3 RSS additions

Added to `RSS_FEEDS` (US/tech/policy desks): NPR News, AP Top News (if a stable feed URL is available; otherwise Reuters via Google News is covered by 3.2), NYT Technology, NYT U.S., Washington Post Technology, Axios, Politico, The Verge, Ars Technica, Wired. Finance desks are added too: MarketWatch Top Stories (`feeds.marketwatch.com/marketwatch/topstories`), CNBC Top News, Yahoo Finance, Investing.com news, and Financial Times headlines (headline + summary only; links may be paywalled).

Exact URLs are validated at implementation time; a feed that fails to fetch is already logged and skipped by the existing code.

### 3.4 Quota guard (`backend/ingestion/quota.py`)

In-process per-source daily counter keyed by UTC date. Budgets (configurable env vars, defaults): `newsapi 90`, `gnews 90`, `newsdata 180`, `guardian 4500`, `brave 30`, `tavily 30`, `exa 40`, `google_news 300`, `finnhub 1000`, `marketaux 90`, `alphavantage 20`. A source whose budget is spent is skipped for the rest of the UTC day (logged once). Counters reset on process restart, which is acceptable at this traffic level. The existing 15-minute per-focus cache prevents repeat spend.

### 3.5 Merge, URL normalization and dedupe

- URLs: strip `utm_*`, `fbclid`, `gclid`, `ocid`, fragments; lower-case host; drop `www.`. Google News items use the feed's `<source url>`/link resolution when present; otherwise the Google News link is kept as-is.
- Existing embedding-based dedupe runs after merge, plus exact-normalized-URL and normalized-title dedupe (case/punctuation-insensitive), keeping the earliest-published copy and recording all outlets.

### 3.6 Ranking (`backend/processing/rerank.py`)

1. **Pre-filter (deterministic):** keep articles whose title+snippet hits ≥ 1 must_term or synonym (word-boundary, case-insensitive, Unicode-aware), or whose TF-IDF similarity to `phrase + must_terms + synonyms` ≥ `RELEVANCE_SIMILARITY_THRESHOLD`. Sort by (hit count, similarity, recency); cap at `RERANK_MAX_CANDIDATES` (60).
2. **Haiku rerank:** one call with the focus, plan, and a numbered list of candidates (title, outlet, date, 300-char snippet). Returns JSON `{"scores": [{"i": <index>, "s": 0|1|2|3}]}` (3 = directly about the focus, 2 = substantially relevant, 1 = tangential, 0 = unrelated). Timeout 8 s, `max_retries=0`, `max_tokens` 1,500. Keep articles scored ≥ 2, highest first, up to `RERANK_KEEP` (25). Missing indices are treated as score 0; malformed output triggers the fallback.
3. **Fallback:** if rerank is disabled, unavailable, or fails, use the existing `filter_by_relevance` (keyword + TF-IDF) on the pre-filtered set, capped at `RERANK_KEEP`.
4. Empty result → existing 422 response.

### 3.7 API and frontend

- `POST /briefing` request/response shapes are unchanged. `source_breakdown` gains the new source names.
- Frontend `SOURCE_LABELS` (`frontend/src/lib/signals.ts`) gains: `google_news → Google News`, `guardian → The Guardian`, `gnews → GNews`, `newsdata → NewsData`, `brave → Brave News`, `tavily → Tavily`, `exa → Exa`, `finnhub → Finnhub`, `marketaux → Marketaux`, `alphavantage → Alpha Vantage`.
- The 502 "no articles" message lists sources skipped for missing keys.

## 4. Configuration

New optional settings in `backend/config.py`, documented in `render.yaml` (as `sync: false` for keys) and the backend README:

| Setting | Default |
|---|---|
| `GUARDIAN_API_KEY`, `GNEWS_API_KEY`, `NEWSDATA_API_KEY`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `FINNHUB_API_KEY`, `MARKETAUX_API_KEY`, `ALPHAVANTAGE_API_KEY` | unset (source disabled) |
| `SEARCH_PLAN_ENABLED` / `SEARCH_PLAN_MODEL` | `true` / `claude-haiku-4-5` |
| `RERANK_ENABLED` / `RERANK_MODEL` | `true` / `claude-haiku-4-5` |
| `RERANK_MAX_CANDIDATES` / `RERANK_KEEP` | `60` / `25` |
| `SOURCE_TIMEOUT_SECONDS` / `INGEST_DEADLINE_SECONDS` | `8` / `15` |
| `QUOTA_<SOURCE>_PER_DAY` | per §3.4 |

LLM calls use the pinned `anthropic==0.40.0` SDK with prompt-instructed JSON + `extract_json` + Pydantic validation, matching `synthesis/briefing.py`. Upgrading the SDK to use native structured outputs (`output_config.format`) is a separate follow-up.

## 5. Observability

One structured log line per briefing: planner source (llm/rules) and latency; per-source `{count, status, ms}`; merged, deduped, pre-filtered, and kept counts; rerank latency and fallback flag; total ingestion ms.

## 6. NewsAPI in production (owner decision recorded)

NewsAPI's free Developer plan terms state it "cannot be used in a staging or production environment"; the restriction is contractual, not technical, so requests from Render still succeed. **Decision (2026-10-17, owner): keep using the existing `NEWSAPI_KEY` in production**, accepting the risk that NewsAPI may suspend the key. The source stays optional, so a suspended or removed key only drops it from the fan-out.

## 7. Testing

- **Finance gating:** finance APIs are not called for "data centers and privacy in the US"; they are called for "Nvidia earnings and AI chip stocks" (LLM plan with tickers) and for "$NVDA guidance" (rule plan); Finnhub market news is filtered by must_terms locally.
- **Rule planner:** the failing example → phrase `data centers privacy`, country `US`, must_terms include `data center(s)` and `privacy`, no `us`; "U.S."/"United States"/"in the UK" variants; "Regeneron Pharmaceuticals" keeps anchor-based behavior; "climate" keeps aliases; existing `test_focus_terms.py` cases updated only where the old exact-phrase behavior was the bug.
- **LLM planner:** valid JSON parsed and clamped; invalid JSON, timeout, API error, and missing key → rules (mocked client).
- **Each source:** respx-mocked success mapped to `Article` with UTC dates; missing key → `enabled()` false and no request; non-2xx/429/malformed → `[]`; country/query parameters formed correctly; quota exhaustion skips the call.
- **Registry:** a slow source is cut at its timeout while others return; the overall deadline holds; one raising source doesn't affect others.
- **URL normalization/dedupe:** tracking params stripped; duplicates across sources collapsed.
- **Rerank:** mocked scores applied, threshold and cap respected, missing indices = 0, malformed output → fallback; pre-filter rejects the "us" + "data" noise article.
- **Relevance regression:** existing labeled precision/recall test stays green (fallback path); new labeled set for broad domestic topics (data centers & privacy, student loans, wildfire insurance) asserts must-term pre-filter recall ≥ 0.9 on relevant items and rejection of pronoun/generic-word noise.
- **Manual end-to-end (keys in `backend/.env`):** success criteria in §1, with per-stage timings from the §5 log line; plus "Nvidia earnings and AI chip stocks" returns finance-source articles (Finnhub/Marketaux/Alpha Vantage or finance RSS) among the kept set.

## 8. Out of scope

Paid tiers, persistent quota storage (Redis/DB), Anthropic SDK upgrade, briefing chat and persona onboarding (backlog), frontend changes beyond source labels.
