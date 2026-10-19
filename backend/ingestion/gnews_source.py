import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, lookback_start, make_article
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "gnews"
FINANCE_ONLY = False
GNEWS_SEARCH = "https://gnews.io/api/v4/search"


def enabled() -> bool:
    return bool(settings.gnews_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """GNews free tier: 100 requests/day, 12 h delay, non-commercial use."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        "q": best_query(plan),
        "lang": "en",
        "max": 10,
        "sortby": "publishedAt",
        "from": lookback_start().strftime("%Y-%m-%dT%H:%M:%SZ"),
        # GNews only accepts the key as a query parameter; main.py silences
        # httpx's INFO request logging so this never leaks the key.
        "apikey": settings.gnews_api_key,
    }
    if plan.country:
        params["country"] = plan.country.lower()
    payload = await get_json(client, GNEWS_SEARCH, source=SOURCE_NAME, params=params)
    items = dict_items(payload.get("articles") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"), snippet=item.get("description"),
                     outlet=(item.get("source") or {}).get("name") or "GNews", published_at=item.get("publishedAt"),
                     image_url=item.get("image"))
        for item in items
    ]
    return [a for a in articles if a]
