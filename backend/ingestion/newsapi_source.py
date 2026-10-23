import logging

import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, make_article
from backend.ingestion.query_format import or_of_ands
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.newsapi")

SOURCE_NAME = "newsapi"
SOURCE_LABEL = "NewsAPI"
FINANCE_ONLY = False
NEWSAPI_EVERYTHING = "https://newsapi.org/v2/everything"


def enabled() -> bool:
    return bool(settings.newsapi_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NewsAPI /everything with the plan's queries OR'd together (free tier delays 24 h)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        "q": or_of_ands(plan.queries or [plan.phrase]),
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": settings.max_articles_per_source,
    }
    # Key in a header so it never appears in logged URLs.
    payload = await get_json(client, NEWSAPI_EVERYTHING, source=SOURCE_NAME, params=params,
                             headers={"X-Api-Key": settings.newsapi_key})
    if not isinstance(payload, dict):
        return []
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"),
                     snippet=item.get("description") or item.get("content"),
                     outlet=(item.get("source") or {}).get("name") or "NewsAPI", published_at=item.get("publishedAt"),
                     image_url=item.get("urlToImage"))
        for item in dict_items(payload.get("articles"))
    ]
    articles = [a for a in articles if a]
    logger.info("source=%s count=%d totalResults=%s", SOURCE_NAME, len(articles), payload.get("totalResults"))
    return articles
