import asyncio
from datetime import datetime, timezone

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, matches_plan, parse_datetime
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "finnhub"
FINANCE_ONLY = True
FINNHUB_MARKET_NEWS = "https://finnhub.io/api/v1/news"
FINNHUB_COMPANY_NEWS = "https://finnhub.io/api/v1/company-news"
_MAX_TICKERS = 3


def enabled() -> bool:
    return bool(settings.finnhub_api_key)


def _to_articles(items: object) -> list[Article]:
    articles: list[Article] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        title, url = clean_text(item.get("headline")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("summary")) or title,
            url=url,
            source=item.get("source") or "Finnhub",
            published_at=parse_datetime(item.get("datetime")),
            country=None,
            raw_source_type="finnhub",
        ))
    return articles


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """General market news (keyword-filtered locally) plus company news per ticker."""
    if not enabled():
        return []
    headers = {"X-Finnhub-Token": settings.finnhub_api_key}
    calls = []
    if quota.take(SOURCE_NAME):
        calls.append(get_json(client, FINNHUB_MARKET_NEWS, source=SOURCE_NAME,
                              params={"category": "general"}, headers=headers))
    start = lookback_start(hours=max(settings.hours_lookback, 72)).date().isoformat()
    end = datetime.now(timezone.utc).date().isoformat()
    tickers = [t for t in plan.tickers[:_MAX_TICKERS] if quota.take(SOURCE_NAME)]
    for ticker in tickers:
        calls.append(get_json(client, FINNHUB_COMPANY_NEWS, source=SOURCE_NAME,
                              params={"symbol": ticker, "from": start, "to": end}, headers=headers))
    if not calls:
        return []
    results = await asyncio.gather(*calls)
    market = results[0] if len(results) > len(tickers) else None
    company_results = results[-len(tickers):] if tickers else []
    articles = [a for a in _to_articles(market) if matches_plan(f"{a.title} {a.snippet}", plan)]
    for result in company_results:
        articles.extend(_to_articles(result)[: settings.max_articles_per_source])
    return articles
