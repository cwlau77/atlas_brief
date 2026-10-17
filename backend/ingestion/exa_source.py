import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, lookback_start, outlet_from_url, parse_datetime, post_json
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "exa"
FINANCE_ONLY = False
EXA_SEARCH = "https://api.exa.ai/search"


def enabled() -> bool:
    return bool(settings.exa_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Exa news search ($10 free credit/month); results carry titles and dates only."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    body = {
        "query": best_query(plan),
        "category": "news",
        "numResults": 10,
        "startPublishedDate": lookback_start(hours=24 * 7).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    payload = await post_json(client, EXA_SEARCH, source=SOURCE_NAME, json_body=body,
                              headers={"x-api-key": settings.exa_api_key})
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
            snippet=title,
            url=url,
            source=outlet_from_url(url) or "Exa",
            published_at=parse_datetime(item.get("publishedDate")),
            country=None,
            raw_source_type="exa",
        ))
    return articles
