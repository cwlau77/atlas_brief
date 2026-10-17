import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, outlet_from_url, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "brave"
FINANCE_ONLY = False
BRAVE_NEWS = "https://api.search.brave.com/res/v1/news/search"


def enabled() -> bool:
    return bool(settings.brave_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Brave News Search (metered: ~$5 monthly credit on new accounts)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"q": best_query(plan), "count": 20, "freshness": "pw", "search_lang": "en"}
    if plan.country:
        params["country"] = plan.country.upper()
    payload = await get_json(client, BRAVE_NEWS, source=SOURCE_NAME, params=params,
                             headers={"X-Subscription-Token": settings.brave_api_key, "Accept": "application/json"})
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
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=(item.get("profile") or {}).get("name") or outlet_from_url(url) or "Brave",
            published_at=parse_datetime(item.get("page_age")),
            country=None,
            raw_source_type="brave",
        ))
    return articles
