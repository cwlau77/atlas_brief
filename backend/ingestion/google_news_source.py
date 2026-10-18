"""Google News RSS search: free, query-based, strong US coverage. Unofficial,
so treated as best effort with a polite User-Agent (set on the shared client)."""

import asyncio
import calendar
import logging
from datetime import datetime, timezone

import feedparser
import httpx

from backend.config import settings
from backend.ingestion.common import make_article, sub_request_timeout
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.google_news")

SOURCE_NAME = "google_news"
FINANCE_ONLY = False
GOOGLE_NEWS_SEARCH = "https://news.google.com/rss/search"


def enabled() -> bool:
    return True


def _parse(text: str) -> list[Article]:
    parsed = feedparser.parse(text)
    articles: list[Article] = []
    for entry in parsed.entries[: settings.max_articles_per_source]:
        title = getattr(entry, "title", "") or ""
        link = getattr(entry, "link", "") or ""
        if not title or not link:
            continue
        outlet = ((getattr(entry, "source", None) or {}).get("title") or "").strip()
        suffix = f" - {outlet}"
        if outlet and title.endswith(suffix):
            title = title[: -len(suffix)]
        published_at = None
        struct_time = getattr(entry, "published_parsed", None)
        if struct_time:
            try:
                published_at = datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc)
            except (OverflowError, ValueError):
                published_at = None
        article = make_article(SOURCE_NAME, title=title, url=link, snippet=getattr(entry, "summary", ""),
                               outlet=outlet or "Google News", published_at=published_at)
        if article:
            articles.append(article)
    return articles


async def _search(client: httpx.AsyncClient, query: str, cc: str) -> str:
    params = {"q": f"{query} when:7d", "hl": f"en-{cc}", "gl": cc, "ceid": f"{cc}:en"}
    try:
        # Per-request timeout, not the client default: several queries share
        # one per-source budget (asyncio.wait_for in the registry), so one
        # slow query must fail on its own with margin to spare.
        resp = await client.get(GOOGLE_NEWS_SEARCH, params=params, timeout=sub_request_timeout())
    except httpx.HTTPError as exc:
        logger.warning("source=google_news status=network_error detail=%s", type(exc).__name__)
        return ""
    if resp.status_code >= 400:
        logger.warning("source=google_news status=http_%d", resp.status_code)
        return ""
    return resp.text


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    cc = (plan.country or "US").upper()
    queries = [q for q in (plan.queries or [plan.phrase])[:3] if quota.take(SOURCE_NAME)]
    texts = await asyncio.gather(*(_search(client, q, cc) for q in queries))
    articles: list[Article] = []
    for text in texts:
        if text:
            articles.extend(await asyncio.to_thread(_parse, text))
    return articles
