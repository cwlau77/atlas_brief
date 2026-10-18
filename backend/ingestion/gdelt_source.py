import asyncio
import logging
import time

import httpx

from backend.config import settings
from backend.ingestion.common import parse_datetime
from backend.ingestion.query_format import best_query, query_terms
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.gdelt")

GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"

# GDELT enforces ~1 request per 5s per IP and Render uses shared egress IPs, so
# 429s are common. A retry can't fit the 8 s source budget, so a 429 returns empty.

# Process-global pacer: concurrent briefing requests must not fire GDELT calls
# closer together than the per-IP limit allows, or they 429 each other.
_pace_lock = asyncio.Lock()
_last_request_at = 0.0


async def _pace() -> None:
    global _last_request_at
    async with _pace_lock:
        wait = settings.gdelt_min_interval_seconds - (time.monotonic() - _last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_at = time.monotonic()


SOURCE_NAME = "gdelt"
FINANCE_ONLY = False

# GDELT sourcecountry takes FIPS codes; only the ones the planner commonly emits are mapped.
_FIPS = {"US": "US", "GB": "UK"}


def enabled() -> bool:
    return True


def _gdelt_query(plan: SearchPlan) -> str:
    # GDELT rejects bare terms shorter than 3 characters ("ai"); quoted phrases are fine.
    terms = [t for t in query_terms(best_query(plan)) if t.startswith('"') or len(t) >= 3]
    query = " ".join(terms) or plan.phrase
    fips = _FIPS.get(plan.country or "")
    if fips:
        query = f"{query} sourcecountry:{fips}"
    return f"{query} sourcelang:english"


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """GDELT DOC 2.0 ArtList for the plan's best query (paced; empty on 429)."""
    params = {
        "query": _gdelt_query(plan),
        "mode": "ArtList",
        "maxrecords": settings.max_articles_per_source,
        "format": "json",
        "timespan": f"{max(settings.hours_lookback, 1)}h",
        "sort": "DateDesc",
    }
    try:
        await _pace()
        resp = await client.get(GDELT_DOC_API, params=params, timeout=httpx.Timeout(settings.gdelt_timeout_seconds))
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPStatusError as exc:
        status = "rate_limited" if exc.response.status_code == 429 else f"http_{exc.response.status_code}"
        logger.warning("source=gdelt status=%s", status)
        return []
    except Exception as exc:
        logger.warning("source=gdelt status=network_error detail=%s", type(exc).__name__)
        return []
    if not isinstance(payload, dict):
        return []
    articles: list[Article] = []
    for item in payload.get("articles") or []:
        title, url = item.get("title") or "", item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title, snippet=title, url=url,
            source=item.get("domain") or "GDELT",
            published_at=parse_datetime(item.get("seendate")),
            country=item.get("sourcecountry") or None,
            raw_source_type="gdelt",
        ))
    return articles
