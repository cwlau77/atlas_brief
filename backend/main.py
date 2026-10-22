import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from backend import turnstile
from backend.config import settings
from backend.ingestion import ingest
from backend.models import Briefing, BriefingRequest
from backend.processing import deduplicate, embed_texts
from backend.processing.rerank import rank_articles
from backend.processing.urls import dedupe_exact
from backend.rate_limit import GlobalBudget, SlidingWindowLimiter
from backend.search_plan import plan_search
from backend.trending import Trending, get_trending
from backend.synthesis import (
    SynthesisFailedError,
    SynthesisUnavailableError,
    enforce_url_allowlist,
    synthesize_briefing,
)

logger = logging.getLogger("briefing")
logging.basicConfig(level=logging.INFO)
# httpx/httpcore log "HTTP Request: GET <full URL>" at INFO, and several sources
# (guardian, gnews, newsdata, alphavantage, marketaux) must send their API key as
# a query parameter because those APIs don't accept it any other way. Keep those
# loggers at WARNING so request URLs (and the keys in them) never hit INFO logs.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

app = FastAPI(
    title="Atlas Brief API",
    version="0.2.0",
    # No public API docs in production: they advertise every endpoint and offer a "try it" form.
    docs_url="/docs" if settings.expose_docs else None,
    redoc_url="/redoc" if settings.expose_docs else None,
    openapi_url="/openapi.json" if settings.expose_docs else None,
)

# Simple in-memory briefing cache: {normalized_focus: (briefing, unix_expiry)}.
# Valid because the backend runs as a single long-running process (Render);
# a serverless deployment would silently lose this and the rate limiter.
_briefing_cache: dict[str, tuple[Briefing, float]] = {}

_limiter = SlidingWindowLimiter(settings.rate_limit_per_minute, 60.0)
_budget = GlobalBudget(settings.briefing_budget_per_hour, settings.briefing_budget_per_day)

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


@app.get("/trending", response_model=Trending)
async def trending_endpoint() -> Trending:
    """Timed topics for Home's "On the wire" list; empty when they can't be produced (Home shows its fixed suggestions)."""
    return await get_trending()


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    info = {"service": "atlas-brief-api", "health": "/health"}
    if settings.expose_docs:
        info["docs"] = "/docs"
    return info


def _client_ip(request: Request) -> str:
    # Proxies append to X-Forwarded-For, so everything left of the last entry is
    # whatever the client chose to send. Only the right-most hop, added by the
    # platform proxy in front of this process, can't be forged.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return hops[-1]
    return request.client.host if request.client else "unknown"


def _missing_key_hint(skipped: list[str]) -> str:
    return f" Sources skipped for missing API keys: {', '.join(skipped)}." if skipped else ""


@app.post("/briefing", response_model=Briefing)
async def briefing_endpoint(req: BriefingRequest, request: Request) -> Briefing:
    if settings.rate_limit_per_minute > 0 and not _limiter.allow(_client_ip(request)):
        raise HTTPException(
            status_code=429,
            detail="Too many briefing requests from this address. Please wait a minute and try again.",
        )

    # Before any work, cached or not: scripts without a browser can't get a token.
    if not await turnstile.verify(request.headers.get("x-turnstile-token")):
        raise HTTPException(
            status_code=403,
            detail="We couldn't verify this request came from a person. Reload the page and try again.",
        )

    focus = req.focus.strip()
    cache_key = focus.lower()

    if settings.cache_ttl_minutes > 0:
        cached = _briefing_cache.get(cache_key)
        if cached and cached[1] > time.time():
            logger.info("cache hit for focus=%r", focus)
            return cached[0]

    # Cached briefings above are free; everything below spends API credit.
    if not _budget.allow():
        logger.warning("briefing budget exhausted; refusing focus=%r", focus)
        raise HTTPException(
            status_code=429,
            detail="Atlas has reached its briefing limit for now. Please try again later.",
        )

    started = time.monotonic()
    steps: dict[str, int] = {}

    def lap(step: str, since: float) -> float:
        now = time.monotonic()
        steps[step] = int((now - since) * 1000)
        return now

    plan = await plan_search(focus)
    mark = lap("plan", started)
    ingest_result = await ingest(plan)
    mark = lap("ingest", mark)
    articles = dedupe_exact(ingest_result.articles)
    merged_count = len(ingest_result.articles)
    if not articles:
        hint = _missing_key_hint(ingest_result.skipped_missing_key) or (
            " All upstream sources returned zero articles — try a broader focus, or retry in a minute in case an upstream rate limit is in effect."
        )
        raise HTTPException(status_code=502, detail=f"No articles could be fetched from any source.{hint}")

    embeddings = await embed_texts([f"{a.title}. {a.snippet}" for a in articles])
    articles, embeddings = deduplicate(articles, embeddings)
    deduped_count = len(articles)
    rank_result = await rank_articles(focus, plan, articles, embeddings)
    articles = rank_result.articles
    mark = lap("rank", mark)

    def log_pipeline() -> None:
        logger.info(
            "briefing pipeline focus=%r plan=%s queries=%s country=%s domains=%s sources=%s skipped=%s "
            "merged=%d deduped=%d candidates=%d kept=%d reranked=%s plan_ms=%d ingest_ms=%d rank_ms=%d "
            "synthesis_ms=%d elapsed_ms=%d",
            focus, plan.source, plan.queries, plan.country, plan.domains,
            {name: f"{s.count}/{s.status}/{s.ms}ms" for name, s in ingest_result.stats.items()},
            ingest_result.skipped_missing_key,
            merged_count, deduped_count, rank_result.candidates, len(articles), rank_result.reranked,
            steps["plan"], steps["ingest"], steps["rank"], steps.get("synthesis", 0),
            int((time.monotonic() - started) * 1000),
        )

    if not articles:
        log_pipeline()
        hint = _missing_key_hint(ingest_result.skipped_missing_key)
        raise HTTPException(
            status_code=422,
            detail=f"No recent articles matched the focus '{focus}'. Try a broader phrase or a different topic.{hint}",
        )

    try:
        # Writes the sections in parallel; historical context is added inside, overlapping them.
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

    lap("synthesis", mark)
    log_pipeline()

    # Server-side guarantee that every cited URL came from the ingested articles.
    briefing = enforce_url_allowlist(briefing, {a.url for a in articles})

    if settings.cache_ttl_minutes > 0:
        _briefing_cache[cache_key] = (briefing, time.time() + settings.cache_ttl_minutes * 60)
    return briefing
