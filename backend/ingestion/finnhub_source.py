import asyncio
from datetime import datetime, timezone

import httpx

from backend.config import settings
from backend.ingestion.common import dict_items, get_json, lookback_start, make_article, matches_plan
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "finnhub"
SOURCE_LABEL = "Finnhub"
FINANCE_ONLY = True
FINNHUB_MARKET_NEWS = "https://finnhub.io/api/v1/news"
FINNHUB_COMPANY_NEWS = "https://finnhub.io/api/v1/company-news"
_MAX_TICKERS = 3


def enabled() -> bool:
    return bool(settings.finnhub_api_key)


def _to_articles(items: object) -> list[Article]:
    articles = [
        make_article(SOURCE_NAME, title=item.get("headline"), url=item.get("url"), snippet=item.get("summary"),
                     outlet=item.get("source") or "Finnhub", published_at=item.get("datetime"),
                     image_url=item.get("image"))
        for item in dict_items(items)
    ]
    return [a for a in articles if a]


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
