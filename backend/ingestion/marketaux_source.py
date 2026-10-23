import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, lookback_start, make_article, outlet_from_url
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "marketaux"
SOURCE_LABEL = "Marketaux"
FINANCE_ONLY = True
MARKETAUX_NEWS = "https://api.marketaux.com/v1/news/all"


def enabled() -> bool:
    return bool(settings.marketaux_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Marketaux free tier: 100 requests/day, 3 articles per request."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        # Marketaux only accepts the key as a query parameter; main.py silences
        # httpx's INFO request logging so this never leaks the key.
        "api_token": settings.marketaux_api_key,
        "language": "en",
        "limit": 3,
        "published_after": lookback_start(hours=max(settings.hours_lookback, 72)).strftime("%Y-%m-%dT%H:%M"),
    }
    if plan.tickers:
        params["symbols"] = ",".join(plan.tickers)
    else:
        params["search"] = best_query(plan)
    if plan.country:
        params["countries"] = plan.country.lower()
    payload = await get_json(client, MARKETAUX_NEWS, source=SOURCE_NAME, params=params)
    items = dict_items(payload.get("data") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"),
                     snippet=item.get("description") or item.get("snippet"),
                     outlet=item.get("source") or outlet_from_url(item.get("url") or "") or "Marketaux",
                     published_at=item.get("published_at"), image_url=item.get("image_url"))
        for item in items
    ]
    return [a for a in articles if a]
