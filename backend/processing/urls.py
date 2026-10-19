"""Exact duplicate removal across sources: normalized URLs and normalized titles."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from backend.models import Article

_TRACKING_KEYS = {"fbclid", "gclid", "ocid", "mc_cid", "mc_eid", "cmpid", "guccounter", "ref"}
_NON_WORD = re.compile(r"[^\w\s]")
_MIN_TITLE_WORDS = 4
_FAR_FUTURE = datetime.max.replace(tzinfo=timezone.utc)


def normalize_url(url: str) -> str:
    raw = url.strip()
    try:
        parts = urlsplit(raw)
    except ValueError:
        return raw
    if not parts.scheme or not parts.netloc:
        return raw
    try:
        host = (parts.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if parts.port:
            host = f"{host}:{parts.port}"
    except ValueError:
        return raw
    query = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not (k.lower().startswith("utm_") or k.lower() in _TRACKING_KEYS)
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), host, path, urlencode(query), ""))


def normalize_title(title: str) -> str:
    return " ".join(_NON_WORD.sub(" ", title.lower()).split())


def with_image_of(survivor: Article, dropped: Article) -> Article:
    """The survivor carrying the dropped copy's image, still credited to the outlet it came from."""
    return survivor.model_copy(update={
        "image_url": dropped.image_url,
        "image_outlet": dropped.image_outlet or dropped.source,
    })


def dedupe_exact(articles: list[Article]) -> list[Article]:
    """Keep the earliest-published copy of each URL/title; undated copies lose to dated ones."""
    order = sorted(range(len(articles)), key=lambda i: (articles[i].published_at or _FAR_FUTURE, i))
    seen_urls: dict[str, int] = {}
    seen_titles: dict[str, int] = {}
    kept: dict[int, Article] = {}
    for i in order:
        article = articles[i]
        url_key = normalize_url(article.url)
        title_key = normalize_title(article.title)
        title_counts = len(title_key.split()) >= _MIN_TITLE_WORDS
        owner = seen_urls.get(url_key)
        if owner is None and title_counts:
            owner = seen_titles.get(title_key)
        if owner is not None:
            # A dropped copy may carry the only image; hand it to the survivor.
            if kept[owner].image_url is None and article.image_url:
                kept[owner] = with_image_of(kept[owner], article)
            continue
        kept[i] = article
        seen_urls[url_key] = i
        if title_counts:
            seen_titles[title_key] = i
    return [kept[i] for i in range(len(articles)) if i in kept]
