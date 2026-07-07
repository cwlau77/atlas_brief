import asyncio
import logging
import time

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.ingestion import fetch_gdelt, fetch_newsapi, fetch_rss
from backend.models import Article, Briefing, BriefingRequest
from backend.processing import deduplicate, embed_texts, filter_by_relevance
from backend.rate_limit import SlidingWindowLimiter
from backend.synthesis import (
    SynthesisFailedError,
    SynthesisUnavailableError,
    enforce_url_allowlist,
    enrich_with_historical_context,
    synthesize_briefing,
)

logger = logging.getLogger("briefing")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Atlas Brief API", version="0.2.0")

# Simple in-memory briefing cache: {normalized_focus: (briefing, unix_expiry)}.
# Valid because the backend runs as a single long-running process (Render);
# a serverless deployment would silently lose this and the rate limiter.
_briefing_cache: dict[str, tuple[Briefing, float]] = {}

_limiter = SlidingWindowLimiter(settings.rate_limit_per_minute, 60.0)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "atlas-brief-api", "docs": "/docs", "health": "/health"}


async def _ingest_all(focus: str) -> list[Article]:
    async with httpx.AsyncClient(timeout=20.0) as client:
        results = await asyncio.gather(
            fetch_newsapi(focus, client=client),
            fetch_gdelt(focus, client=client),
            fetch_rss(focus),
            return_exceptions=True,
        )

    labels = ("newsapi", "gdelt", "rss")
    articles: list[Article] = []
    per_source_counts: dict[str, int] = {}
    for label, r in zip(labels, results):
        if isinstance(r, Exception):
            logger.warning("ingestion source %s failed: %s", label, r)
            per_source_counts[label] = 0
            continue
        per_source_counts[label] = len(r)
        articles.extend(r)
    logger.info("ingestion summary for focus=%r: %s", focus, per_source_counts)
    return articles


def _client_ip(request: Request) -> str:
    # Render/Vercel sit behind proxies; the first X-Forwarded-For hop is the client.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.post("/briefing", response_model=Briefing)
async def briefing_endpoint(req: BriefingRequest, request: Request) -> Briefing:
    if settings.rate_limit_per_minute > 0 and not _limiter.allow(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many briefing requests from this address. Please wait a minute and try again.",
        )

    focus = req.focus.strip()
    cache_key = focus.lower()

    # Check cache first — skip the whole pipeline if we have a fresh briefing
    # for this focus within the configured TTL.
    if settings.cache_ttl_minutes > 0:
        cached = _briefing_cache.get(cache_key)
        if cached and cached[1] > time.time():
            logger.info("cache hit for focus=%r", focus)
            return cached[0]

    # Layer 2: ingest (parallel fan-out)
    articles = await _ingest_all(focus)
    logger.info("ingested %d raw articles for focus=%r", len(articles), focus)
    if not articles:
        missing_keys = []
        if not settings.newsapi_key:
            missing_keys.append("NEWSAPI_KEY")
        hint = (
            f" (missing env vars: {', '.join(missing_keys)})"
            if missing_keys
            else " All upstream sources returned zero articles — try a broader focus, or retry in a minute in case an upstream rate limit is in effect."
        )
        raise HTTPException(
            status_code=502,
            detail=f"No articles could be fetched from any source.{hint}",
        )

    # Layer 3: process (embed -> dedupe -> relevance filter)
    # Embedding is now a local TF-IDF hashing vectorizer — no external calls,
    # no API key required, no rate limits. It returns a populated matrix
    # unconditionally (unless the input list is empty).
    texts = [f"{a.title}. {a.snippet}" for a in articles]
    embeddings = await embed_texts(texts)

    articles, embeddings = deduplicate(articles, embeddings)
    articles, embeddings = await filter_by_relevance(focus, articles, embeddings)

    logger.info("post-processing article count: %d", len(articles))
    if not articles:
        hint = (
            " Missing environment variable NEWSAPI_KEY may be reducing recall."
            if not settings.newsapi_key
            else ""
        )
        raise HTTPException(
            status_code=422,
            detail=f"No recent articles matched the focus '{focus}'. Try a broader phrase or a different topic.{hint}",
        )

    # Layer 4: synthesize structured briefing (Haiku by default, per settings.synthesis_model)
    try:
        briefing = await synthesize_briefing(focus, articles)
    except SynthesisUnavailableError:
        raise HTTPException(
            status_code=503,
            detail="Briefing synthesis is not configured on this server (missing ANTHROPIC_API_KEY).",
        )
    except SynthesisFailedError:
        logger.exception("synthesis failed twice for focus=%r", focus)
        raise HTTPException(
            status_code=502,
            detail="The synthesis model returned an unreadable response twice. Please retry in a moment.",
        )

    # Server-side guarantee that every cited URL came from the ingested articles.
    briefing = enforce_url_allowlist(briefing, {a.url for a in articles})

    # Layer 4b: enrich key developments with historical context (parallel Haiku calls,
    # capped by context_enrichment_limit for speed).
    briefing = await enrich_with_historical_context(briefing)

    # Populate cache.
    if settings.cache_ttl_minutes > 0:
        _briefing_cache[cache_key] = (briefing, time.time() + settings.cache_ttl_minutes * 60)

    # Layer 5: return
    return briefing
