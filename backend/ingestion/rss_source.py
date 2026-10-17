import asyncio
import calendar
import logging
from datetime import datetime, timezone

import feedparser
import httpx

from backend.config import settings
from backend.focus_terms import keyword_hit
from backend.ingestion.common import sub_request_timeout
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.rss")

# Deliberately spans regions: a "global briefing" product fed only by Western
# outlets can't surface cross-region framing differences. All feeds verified
# live on 2026-07-06; English-language regional outlets still carry their own
# framing bias — an accepted limitation short of multilingual ingestion.
RSS_FEEDS: list[tuple[str, str]] = [
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
    ("The Guardian World", "https://www.theguardian.com/world/rss"),
    ("NPR World", "https://feeds.npr.org/1004/rss.xml"),
    ("The Hindu", "https://www.thehindu.com/news/international/feeder/default.rss"),
    ("Deutsche Welle", "https://rss.dw.com/rdf/rss-en-world"),
    ("France 24", "https://www.france24.com/en/rss"),
    ("AllAfrica", "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf"),
    ("Straits Times", "https://www.straitstimes.com/news/world/rss.xml"),
    # Major US outlets (all verified live 2026-07-07). NewsAPI's free tier
    # under-covers these, so their official feeds are the reliable path in.
    ("CNN World", "http://rss.cnn.com/rss/edition_world.rss"),
    ("Fox News World", "https://moxie.foxnews.com/google-publisher/world.xml"),
    ("New York Times World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
    ("Washington Post World", "https://feeds.washingtonpost.com/rss/world"),
    ("ABC News International", "https://abcnews.go.com/abcnews/internationalheadlines"),
    ("CBS News World", "https://www.cbsnews.com/latest/rss/world"),
    # US national, tech and policy desks (domestic coverage the world desks miss).
    # Verified live 2026-10-17; two candidates were dropped after failing curl
    # verification: Washington Post Technology (502 from feeds.washingtonpost.com)
    # and Yahoo Finance (404 on every known RSS path) — see task-4-report.md.
    ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ("New York Times U.S.", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"),
    ("New York Times Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"),
    ("Axios", "https://api.axios.com/feed/"),
    ("Politico", "https://rss.politico.com/politics-news.xml"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("Wired", "https://www.wired.com/feed/rss"),
    # Finance desks.
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories"),
    ("CNBC Top News", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("Investing.com", "https://www.investing.com/rss/news.rss"),
    ("Financial Times", "https://www.ft.com/rss/home"),
]

def _entry_to_article(outlet: str, entry) -> Article | None:
    title = getattr(entry, "title", "") or ""
    link = getattr(entry, "link", "") or ""
    snippet = getattr(entry, "summary", "") or title
    if not title or not link:
        return None

    published_at = None
    struct_time = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if struct_time:
        try:
            # published_parsed/updated_parsed are already UTC (feedparser's
            # contract); calendar.timegm treats the struct as UTC, unlike
            # time.mktime which wrongly treats it as local time.
            published_at = datetime.fromtimestamp(calendar.timegm(struct_time), tz=timezone.utc)
        except Exception:
            published_at = None

    return Article(
        title=title,
        snippet=snippet,
        url=link,
        source=outlet,
        published_at=published_at,
        country=None,
        raw_source_type="rss",
    )


def _parse_feed(outlet: str, content: str, keywords: list[str]) -> list[Article]:
    """Parse already-fetched feed XML and keyword-filter its entries."""
    try:
        parsed = feedparser.parse(content)
    except Exception as exc:
        logger.warning("feed %s failed to parse: %s", outlet, exc)
        return []

    if not parsed.entries and getattr(parsed, "bozo", False):
        logger.warning("feed %s returned no entries (bozo: %s)", outlet, getattr(parsed, "bozo_exception", "?"))
        return []

    entries = list(parsed.entries[: settings.max_articles_per_source * 3])
    filtered: list[Article] = []
    for entry in entries:
        article = _entry_to_article(outlet, entry)
        if article is None:
            continue
        if keywords and not keyword_hit(f"{article.title} {article.snippet}", keywords):
            continue
        filtered.append(article)
        if len(filtered) >= settings.max_articles_per_source:
            break

    # No fallback on empty. An earlier version returned raw top-K when the
    # keyword filter matched zero — that regressed to the "only-Iran" bug,
    # because world-news RSS frontpages are dominated by whatever is currently
    # in the news cycle (right now: Iran/Israel/war). If the focus doesn't
    # match this feed, NewsAPI + GDELT will supply articles instead.
    return filtered


async def _fetch_feed_text(client: httpx.AsyncClient, outlet: str, url: str) -> str:
    try:
        # A per-request timeout shorter than the per-source budget: ~27 feeds
        # share one asyncio.wait_for(source_timeout_seconds) in the registry,
        # so one hung feed must fail on its own with margin to spare rather
        # than consuming the whole budget and wiping every feed's results.
        resp = await client.get(url, timeout=sub_request_timeout())
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        logger.warning("feed %s (%s) fetch failed: %s", outlet, url, exc or type(exc).__name__)
        return ""


SOURCE_NAME = "rss"
FINANCE_ONLY = False


def enabled() -> bool:
    return True


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Curated feeds fetched concurrently on the shared client, keyword-filtered by the plan."""
    keywords = plan.match_terms
    contents = await asyncio.gather(*(_fetch_feed_text(client, outlet, url) for outlet, url in RSS_FEEDS))
    tasks = [
        asyncio.to_thread(_parse_feed, outlet, content, keywords)
        for (outlet, _), content in zip(RSS_FEEDS, contents)
        if content
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles: list[Article] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning("source=rss status=malformed detail=%s", type(result).__name__)
            continue
        articles.extend(result)
    logger.info("source=rss feeds=%d count=%d", sum(1 for c in contents if c), len(articles))
    return articles
