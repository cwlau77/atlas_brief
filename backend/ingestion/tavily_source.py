import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, make_article, outlet_from_url, post_json
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
    items = dict_items(payload.get("results") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"), snippet=item.get("content"),
                     outlet=outlet_from_url(item.get("url") or "") or "Tavily", published_at=item.get("published_date"))
        for item in items
    ]
    return [a for a in articles if a]
