from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved relative to this file, not the process cwd — a bare ".env" would
# silently fail to load whenever the app starts from a different working
# directory than backend/ (e.g. `uvicorn backend.main:app` from the repo
# root, which is how render.yaml and the README both invoke it).
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    anthropic_api_key: Optional[str] = None
    newsapi_key: Optional[str] = None
    guardian_api_key: Optional[str] = None
    gnews_api_key: Optional[str] = None
    newsdata_api_key: Optional[str] = None
    brave_api_key: Optional[str] = None
    tavily_api_key: Optional[str] = None
    exa_api_key: Optional[str] = None
    finnhub_api_key: Optional[str] = None
    marketaux_api_key: Optional[str] = None
    alphavantage_api_key: Optional[str] = None

    max_articles_per_source: int = 15
    # GDELT allows ~1 request per 5s per IP; all outbound GDELT calls from this
    # process are serialized and spaced by at least this many seconds.
    gdelt_min_interval_seconds: float = 5.5
    # GDELT is often slow or 429s from shared IPs; as the slowest source it set the
    # whole ingest time, so it gets a tighter cap than source_timeout_seconds.
    gdelt_timeout_seconds: float = 4.0
    dedup_similarity_threshold: float = 0.85
    relevance_similarity_threshold: float = 0.30
    hours_lookback: int = 24

    # Haiku is ~5x faster than Sonnet and produces solid structured JSON for this task.
    # Override via SYNTHESIS_MODEL env var if you want higher-quality/slower Sonnet output.
    synthesis_model: str = "claude-haiku-4-5"
    context_model: str = "claude-haiku-4-5"
    # Output cap for the briefing JSON. 25 articles with long Google News URLs
    # overflowed 4000 tokens and truncated the JSON mid-reply.
    synthesis_max_tokens: int = 12000

    # Without an Anthropic key the server refuses to synthesize (503) unless this
    # flag explicitly opts into the keyword-matched fallback "demo" briefing.
    demo_mode: bool = False

    # Comma-separated list of allowed CORS origins. The Vercel rewrite proxy makes
    # browser traffic same-origin, so this is a backup layer, not load-bearing.
    allowed_origins: str = "*"
    # Per-client-IP request budget for POST /briefing. 0 disables limiting.
    rate_limit_per_minute: int = 6
    # Cap on new (uncached) briefings across ALL clients: the real bound on API spend,
    # since per-IP limits can be beaten with many addresses. 0 disables a window.
    briefing_budget_per_hour: int = 20
    briefing_budget_per_day: int = 100
    # Cloudflare Turnstile secret. When set, POST /briefing needs a valid X-Turnstile-Token
    # (the frontend gets one when VITE_TURNSTILE_SITE_KEY is set). Unset = no check.
    turnstile_secret_key: Optional[str] = None
    # Publish FastAPI's /docs, /redoc and /openapi.json. Keep off in production.
    expose_docs: bool = False

    # Cache a generated briefing for this many minutes (per focus). 0 disables caching.
    cache_ttl_minutes: int = 15
    # How many key developments to enrich with historical context (cap for speed).
    context_enrichment_limit: int = 4

    # Search planning (LLM turns the focus into queries; rules are the fallback).
    search_plan_enabled: bool = True
    search_plan_model: str = "claude-haiku-4-5"
    search_plan_timeout_seconds: float = 4.0

    # Fan-out timing.
    # Tight on purpose: one slow source is skipped rather than holding up the briefing.
    source_timeout_seconds: float = 6.0
    ingest_deadline_seconds: float = 7.0

    # Per-source daily request budgets (UTC day, in-process). Unlisted sources are unlimited.
    quota_newsapi_per_day: int = 90
    quota_gnews_per_day: int = 90
    quota_newsdata_per_day: int = 180
    quota_guardian_per_day: int = 4500
    quota_brave_per_day: int = 30
    quota_tavily_per_day: int = 30
    quota_exa_per_day: int = 40
    quota_google_news_per_day: int = 300
    quota_finnhub_per_day: int = 1000
    quota_marketaux_per_day: int = 90
    quota_alphavantage_per_day: int = 20

    # Home trending topics (Google News top stories grouped by Haiku; none without a key).
    trending_model: str = "claude-haiku-4-5"
    trending_timeout_seconds: float = 8.0
    trending_ttl_minutes: int = 60

    # Relevance rerank (Haiku scores pre-filtered candidates; keyword + TF-IDF is the fallback).
    rerank_enabled: bool = True
    commons_images_enabled: bool = True
    rerank_model: str = "claude-haiku-4-5"
    rerank_timeout_seconds: float = 8.0
    rerank_max_candidates: int = 60
    rerank_keep: int = 25


settings = Settings()
