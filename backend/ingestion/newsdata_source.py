import logging

import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, make_article
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.newsdata")

SOURCE_NAME = "newsdata"
SOURCE_LABEL = "NewsData.io"
FINANCE_ONLY = False
NEWSDATA_LATEST = "https://newsdata.io/api/1/latest"
_MAX_QUERY_CHARS = 100  # NewsData rejects longer q values


def enabled() -> bool:
    return bool(settings.newsdata_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NewsData.io free tier: 200 credits/day, 10 articles per credit."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    # NewsData only accepts the key as a query parameter; main.py silences
    # httpx's INFO request logging so this never leaks the key.
    params = {"apikey": settings.newsdata_api_key, "q": best_query(plan)[:_MAX_QUERY_CHARS], "language": "en"}
    if plan.country:
        params["country"] = plan.country.lower()
    payload = await get_json(client, NEWSDATA_LATEST, source=SOURCE_NAME, params=params)
    if not isinstance(payload, dict):
        return []
    if payload.get("status") != "success":
        logger.warning("source=newsdata status=api_error")
        return []
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("link"), snippet=item.get("description"),
                     outlet=item.get("source_name") or item.get("source_id") or "NewsData",
                     published_at=item.get("pubDate"), image_url=item.get("image_url"))
        for item in dict_items(payload.get("results"))
    ]
    return [a for a in articles if a]
