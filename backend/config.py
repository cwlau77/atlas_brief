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
    huggingface_api_key: Optional[str] = None

    max_articles_per_source: int = 15
    # GDELT allows ~1 request per 5s per IP; all outbound GDELT calls from this
    # process are serialized and spaced by at least this many seconds.
    gdelt_min_interval_seconds: float = 5.5
    dedup_similarity_threshold: float = 0.85
    relevance_similarity_threshold: float = 0.30
    hours_lookback: int = 24

    # Haiku is ~5x faster than Sonnet and produces solid structured JSON for this task.
    # Override via SYNTHESIS_MODEL env var if you want higher-quality/slower Sonnet output.
    synthesis_model: str = "claude-haiku-4-5"
    context_model: str = "claude-haiku-4-5"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Without an Anthropic key the server refuses to synthesize (503) unless this
    # flag explicitly opts into the keyword-matched fallback "demo" briefing.
    demo_mode: bool = False

    # Comma-separated list of allowed CORS origins. The Vercel rewrite proxy makes
    # browser traffic same-origin, so this is a backup layer, not load-bearing.
    allowed_origins: str = "*"
    # Per-client-IP request budget for POST /briefing. 0 disables limiting.
    rate_limit_per_minute: int = 6

    # Cache a generated briefing for this many minutes (per focus). 0 disables caching.
    cache_ttl_minutes: int = 15
    # How many key developments to enrich with historical context (cap for speed).
    context_enrichment_limit: int = 4


settings = Settings()
