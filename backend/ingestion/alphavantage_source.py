import logging

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, matches_plan, parse_datetime
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.alphavantage")

SOURCE_NAME = "alphavantage"
FINANCE_ONLY = True
ALPHAVANTAGE_QUERY = "https://www.alphavantage.co/query"
_TOPICS = {"finance": "financial_markets,economy_macro", "tech": "technology"}


def enabled() -> bool:
    return bool(settings.alphavantage_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NEWS_SENTIMENT by tickers, or by mapped topics (then keyword-filtered). 25 requests/day free."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"function": "NEWS_SENTIMENT", "sort": "LATEST", "limit": 50, "apikey": settings.alphavantage_api_key}
    if plan.tickers:
        params["tickers"] = ",".join(plan.tickers)
    else:
        params["topics"] = ",".join(_TOPICS[d] for d in plan.domains if d in _TOPICS) or _TOPICS["finance"]
    payload = await get_json(client, ALPHAVANTAGE_QUERY, source=SOURCE_NAME, params=params)
    if not isinstance(payload, dict):
        return []
    if "feed" not in payload:
        # Throttling and errors come back as HTTP 200 with an Information/Note/Error message.
        logger.warning("source=alphavantage status=api_error")
        return []
    articles: list[Article] = []
    for item in payload.get("feed") or []:
        if not isinstance(item, dict):
            continue
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        article = Article(
            title=title,
            snippet=clean_text(item.get("summary")) or title,
            url=url,
            source=item.get("source") or "Alpha Vantage",
            published_at=parse_datetime(item.get("time_published")),
            country=None,
            raw_source_type="alphavantage",
        )
        if plan.tickers or matches_plan(f"{article.title} {article.snippet}", plan):
            articles.append(article)
    return articles[: settings.max_articles_per_source]
