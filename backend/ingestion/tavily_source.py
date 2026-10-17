import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, outlet_from_url, parse_datetime, post_json
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "tavily"
FINANCE_ONLY = False
TAVILY_SEARCH = "https://api.tavily.com/search"


def enabled() -> bool:
    return bool(settings.tavily_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Tavily news search (1,000 free credits/month)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    body = {"query": best_query(plan), "topic": "news", "days": 7, "max_results": 15, "search_depth": "basic"}
    payload = await post_json(client, TAVILY_SEARCH, source=SOURCE_NAME, json_body=body,
                              headers={"Authorization": f"Bearer {settings.tavily_api_key}"})
    items = payload.get("results") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("content")) or title,
            url=url,
            source=outlet_from_url(url) or "Tavily",
            published_at=parse_datetime(item.get("published_date")),
            country=None,
            raw_source_type="tavily",
        ))
    return articles
