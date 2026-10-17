import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, outlet_from_url, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "marketaux"
FINANCE_ONLY = True
MARKETAUX_NEWS = "https://api.marketaux.com/v1/news/all"


def enabled() -> bool:
    return bool(settings.marketaux_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Marketaux free tier: 100 requests/day, 3 articles per request."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
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
    items = payload.get("data") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description") or item.get("snippet")) or title,
            url=url,
            source=item.get("source") or outlet_from_url(url) or "Marketaux",
            published_at=parse_datetime(item.get("published_at")),
            country=None,
            raw_source_type="marketaux",
        ))
    return articles
