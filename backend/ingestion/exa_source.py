import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, lookback_start, make_article, outlet_from_url, post_json
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
    items = dict_items(payload.get("results") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"),
                     outlet=outlet_from_url(item.get("url") or "") or "Exa", published_at=item.get("publishedDate"),
                     image_url=item.get("image"))
        for item in items
    ]
    return [a for a in articles if a]
