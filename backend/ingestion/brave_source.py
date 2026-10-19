import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, make_article, outlet_from_url
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
    items = dict_items(payload.get("results") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"), snippet=item.get("description"),
                     outlet=(item.get("profile") or {}).get("name") or outlet_from_url(item.get("url") or "") or "Brave",
                     published_at=item.get("page_age"), image_url=_thumbnail(item))
        for item in items
    ]
    return [a for a in articles if a]


def _thumbnail(item: dict) -> str | None:
    thumb = item.get("thumbnail")
    return thumb.get("src") if isinstance(thumb, dict) else None
