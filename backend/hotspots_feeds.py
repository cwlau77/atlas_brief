"""Fetch and parse the 14 world-desk RSS feeds for the Hotspots page.

Reuses the briefing's feed list and fetcher; unlike the briefing parser it keeps
every entry (no cap, no keyword filter) and reads each entry's feed image.
"""
import asyncio
import logging

import feedparser
import httpx

from backend.ingestion.common import make_article
from backend.ingestion.rss_source import RSS_FEEDS, _entry_to_article, _fetch_feed_text
from backend.models import Article

logger = logging.getLogger("briefing.hotspots")

WORLD_DESKS: tuple[str, ...] = (
    "BBC World", "Al Jazeera", "The Guardian World", "NPR World", "The Hindu",
    "Deutsche Welle", "France 24", "AllAfrica", "Straits Times", "CNN World",
    "Fox News World", "New York Times World", "ABC News International", "CBS News World",
)

_FEED_URLS = dict(RSS_FEEDS)


def _entry_image(entry) -> str | None:
    for key in ("media_content", "media_thumbnail"):
        for media in getattr(entry, key, None) or []:
            url = media.get("url")
            if url:
                return url
    for link in getattr(entry, "enclosures", None) or []:
        if str(link.get("type", "")).startswith("image/") and link.get("href"):
            return link["href"]
    return None


def parse_entries(outlet: str, content: str) -> list[Article]:
    """Every entry of an already-fetched feed as an Article, or [] when it is not a feed."""
    try:
        parsed = feedparser.parse(content)
    except Exception as exc:
        logger.warning("hotspots feed %s failed to parse: %s", outlet, exc)
        return []
    if not parsed.entries:
        if getattr(parsed, "bozo", False):
            logger.warning("hotspots feed %s returned no entries (bozo: %s)",
                           outlet, getattr(parsed, "bozo_exception", "?"))
        return []
    articles: list[Article] = []
    for entry in parsed.entries:
        article = _entry_to_article(outlet, entry)
        if article is None:
            continue
        image = _entry_image(entry)
        if image:
            # Re-run through make_article's https-only image rule.
            rebuilt = make_article(article.raw_source_type, title=article.title, url=article.url,
                                   snippet=article.snippet, outlet=outlet,
                                   published_at=article.published_at, image_url=image)
            article = rebuilt or article
        articles.append(article)
    return articles


async def fetch_world_desks(client: httpx.AsyncClient) -> tuple[list[Article], int]:
    """Articles from all world desks, and how many desks returned at least one entry."""
    contents = await asyncio.gather(*(_fetch_feed_text(client, name, _FEED_URLS[name]) for name in WORLD_DESKS))
    parsed = await asyncio.gather(
        *(asyncio.to_thread(parse_entries, name, content) for name, content in zip(WORLD_DESKS, contents) if content),
        return_exceptions=True,
    )
    articles: list[Article] = []
    answered = 0
    for result in parsed:
        if isinstance(result, Exception):
            logger.warning("hotspots feed malformed: %s", type(result).__name__)
            continue
        if result:
            answered += 1
            articles.extend(result)
    logger.info("hotspots desks=%d count=%d", answered, len(articles))
    return articles, answered
