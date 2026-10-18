import asyncio

import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, lookback_start, make_article, sub_request_timeout
from backend.ingestion.query_format import and_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "guardian"
FINANCE_ONLY = False
GUARDIAN_SEARCH = "https://content.guardianapis.com/search"


def enabled() -> bool:
    return bool(settings.guardian_api_key)


async def _search(client: httpx.AsyncClient, query: str) -> list[Article]:
    params = {
        "q": and_query(query),
        # The Content API only accepts the key as a query parameter; main.py
        # silences httpx's INFO request logging so this never leaks the key.
        "api-key": settings.guardian_api_key,
        "order-by": "newest",
        "page-size": settings.max_articles_per_source,
        "show-fields": "trailText",
        "from-date": lookback_start().date().isoformat(),
    }
    # Per-request timeout, not the client default: 2 queries share one
    # per-source budget (asyncio.wait_for in the registry), so one slow
    # query must fail on its own with margin to spare.
    payload = await get_json(client, GUARDIAN_SEARCH, source=SOURCE_NAME, params=params, timeout=sub_request_timeout())
    response = payload.get("response") if isinstance(payload, dict) else None
    results = response.get("results") if isinstance(response, dict) else None
    articles = [
        make_article(SOURCE_NAME, title=item.get("webTitle"), url=item.get("webUrl"),
                     snippet=(item.get("fields") or {}).get("trailText"), outlet="The Guardian",
                     published_at=item.get("webPublicationDate"), country="GB")
        for item in dict_items(results)
    ]
    return [a for a in articles if a]


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    if not enabled():
        return []
    queries = [q for q in (plan.queries or [plan.phrase])[:2] if quota.take(SOURCE_NAME)]
    batches = await asyncio.gather(*(_search(client, q) for q in queries))
    return [a for batch in batches for a in batch]
