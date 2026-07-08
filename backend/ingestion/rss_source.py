import asyncio
import logging
from datetime import datetime, timezone
from time import mktime

import feedparser
import httpx

from backend.config import settings
from backend.focus_terms import extract_focus_terms, keyword_hit
from backend.models import Article

logger = logging.getLogger("briefing.rss")

# Fetch feeds with httpx rather than letting feedparser fetch internally:
# feedparser's urllib fetch has no timeout (a hung feed blocks its worker
# thread indefinitely) and swallows network/SSL errors as a silent bozo
# result with zero entries, which is undebuggable in production logs.
_FEED_TIMEOUT_SECONDS = 10.0
_FEED_USER_AGENT = "AtlasBrief/1.0 (+https://github.com/cwlau77/guaihack.global_brief_gen)"

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
            published_at = datetime.fromtimestamp(mktime(struct_time), tz=timezone.utc)
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
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        logger.warning("feed %s (%s) fetch failed: %s", outlet, url, exc or type(exc).__name__)
        return ""


async def fetch_rss(focus: str) -> list[Article]:
    """Pull articles from curated RSS feeds, pre-filtered by focus keywords.

    Feeds are fetched concurrently with httpx (real timeouts, logged failures),
    then parsed in threads since feedparser is blocking CPU work.
    """
    keywords = extract_focus_terms(focus)

    async with httpx.AsyncClient(
        timeout=_FEED_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers={"User-Agent": _FEED_USER_AGENT},
    ) as client:
        contents = await asyncio.gather(
            *(_fetch_feed_text(client, outlet, url) for outlet, url in RSS_FEEDS),
        )

    tasks = [
        asyncio.to_thread(_parse_feed, outlet, content, keywords)
        for (outlet, _), content in zip(RSS_FEEDS, contents)
        if content
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    articles: list[Article] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning("feed parse raised: %s", result)
            continue
        articles.extend(result)
    logger.info(
        "rss summary for focus=%r: %d feeds fetched, %d articles kept",
        focus, sum(1 for c in contents if c), len(articles),
    )
    return articles
