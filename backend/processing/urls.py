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


def dedupe_exact(articles: list[Article]) -> list[Article]:
    """Keep the earliest-published copy of each URL/title; undated copies lose to dated ones."""
    order = sorted(range(len(articles)), key=lambda i: (articles[i].published_at or _FAR_FUTURE, i))
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    keep: set[int] = set()
    for i in order:
        article = articles[i]
        url_key = normalize_url(article.url)
        title_key = normalize_title(article.title)
        title_counts = len(title_key.split()) >= _MIN_TITLE_WORDS
        if url_key in seen_urls or (title_counts and title_key in seen_titles):
            continue
        keep.add(i)
        seen_urls.add(url_key)
        if title_counts:
            seen_titles.add(title_key)
    return [a for i, a in enumerate(articles) if i in keep]
