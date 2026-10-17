import logging

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.newsdata")

SOURCE_NAME = "newsdata"
FINANCE_ONLY = False
NEWSDATA_LATEST = "https://newsdata.io/api/1/latest"
_MAX_QUERY_CHARS = 100  # NewsData rejects longer q values


def enabled() -> bool:
    return bool(settings.newsdata_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NewsData.io free tier: 200 credits/day, 10 articles per credit."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"apikey": settings.newsdata_api_key, "q": best_query(plan)[:_MAX_QUERY_CHARS], "language": "en"}
    if plan.country:
        params["country"] = plan.country.lower()
    payload = await get_json(client, NEWSDATA_LATEST, source=SOURCE_NAME, params=params)
    if not isinstance(payload, dict):
        return []
    if payload.get("status") != "success":
        logger.warning("source=newsdata status=api_error")
        return []
    articles: list[Article] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        title, url = item.get("title") or "", item.get("link") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=item.get("source_name") or item.get("source_id") or "NewsData",
            published_at=parse_datetime(item.get("pubDate")),
            country=None,
            raw_source_type="newsdata",
        ))
    return articles
