import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, parse_datetime
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
    articles: list[Article] = []
    items = payload.get("articles") if isinstance(payload, dict) else None
    for item in items or []:
        title, url = item.get("title") or "", item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=(item.get("source") or {}).get("name") or "GNews",
            published_at=parse_datetime(item.get("publishedAt")),
            country=None,
            raw_source_type="gnews",
        ))
    return articles
