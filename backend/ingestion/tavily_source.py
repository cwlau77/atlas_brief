import re
from urllib.parse import urlsplit

import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, make_article, outlet_from_url, post_json
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "tavily"
SOURCE_LABEL = "Tavily"
FINANCE_ONLY = False
TAVILY_SEARCH = "https://api.tavily.com/search"
# Page images that are site furniture, not the story's photo. Matched against the URL path.
NOT_PHOTO = re.compile(r"\.(svg|gif|ico)$|logo|icon|avatar|placeholder|default|sprite|banner", re.I)


def enabled() -> bool:
    return bool(settings.tavily_api_key)


def first_photo(images: object) -> str | None:
    """The first of a result's page images that looks like a photo. Entries are URLs or {"url": ...}."""
    if not isinstance(images, list):
        return None
    for entry in images:
        url = entry.get("url") if isinstance(entry, dict) else entry
        if isinstance(url, str) and not NOT_PHOTO.search(urlsplit(url).path):
            return url
    return None


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Tavily news search (1,000 free credits/month)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    body = {"query": best_query(plan), "topic": "news", "days": 7, "max_results": 15, "search_depth": "basic",
            "include_images": True}
    payload = await post_json(client, TAVILY_SEARCH, source=SOURCE_NAME, json_body=body,
                              headers={"Authorization": f"Bearer {settings.tavily_api_key}"})
    items = dict_items(payload.get("results") if isinstance(payload, dict) else None)
    articles = [
        make_article(SOURCE_NAME, title=item.get("title"), url=item.get("url"), snippet=item.get("content"),
                     outlet=outlet_from_url(item.get("url") or "") or "Tavily", published_at=item.get("published_date"),
                     image_url=first_photo(item.get("images")))
        for item in items
    ]
    return [a for a in articles if a]
