"""Hotspots snapshot: per-country article counts over the last 24 hours of world-desk feeds.

Pure building lives here (no I/O, no LLM); the cache and images are layered on top.
"""
from __future__ import annotations

import math
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from itertools import combinations
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.hotspots_match import COUNTRIES, countries_named, country_terms
from backend.models import Article
from backend.processing.urls import normalize_url

WINDOW_HOURS = 24
_FUTURE_SLACK = timedelta(minutes=10)
_MIN_SHARED_FOR_WITH = 3
_MAX_WITH = 3
_BLURB_WORDS = 30

Tier = Literal["quiet", "active", "elevated", "high"]

_STOPWORDS = frozenset(
    "a about above after again against all also am an and any are as at be because been before being below "
    "between both but by can could did do does doing down during each few for from further had has have having "
    "he her here hers him his how if in into is it its just may might more most must new no nor not now of off "
    "on once only or other our out over own said says same say she should so some such than that the their them "
    "then there these they this those through to too under until up us very was we were what when where which "
    "while who whom why will with would you your amid via near says".split()
)
_OUTLET_SUFFIX = re.compile(r"\s+[-–—|]\s+[^-–—|]+$")
_PUNCT = re.compile(r"[^\w\s]")
_WORD = re.compile(r"[^\W_]+")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


class StoryArticle(BaseModel):
    title: str
    url: str
    outlet: str
    published_at: datetime
    image_url: str | None = None


class StoryImage(BaseModel):
    url: str
    credit: str


class Story(BaseModel):
    headline: str
    blurb: str | None = None
    article: StoryArticle
    image: StoryImage | None = None


class CountryHeat(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    iso2: str
    iso_numeric: str
    name: str
    n: int
    tier: Tier
    hourly: list[int]
    with_: list[str] = Field(alias="with")
    story: Story | None = None


class Cutoffs(BaseModel):
    active: int
    elevated: int
    high: int


class Hotspots(BaseModel):
    generated_at: datetime
    window_hours: int = WINDOW_HOURS
    coverage_hours: int
    total_articles: int
    feeds: int
    cutoffs: Cutoffs
    countries: list[CountryHeat]


def cutoffs_for(total: int) -> Cutoffs:
    return Cutoffs(
        active=max(3, math.ceil(0.015 * total)),
        elevated=max(8, math.ceil(0.04 * total)),
        high=max(15, math.ceil(0.08 * total)),
    )


def merge_store(store: dict[str, Article], fresh: list[Article], now: datetime) -> dict[str, Article]:
    """Add fresh articles to the store, keyed by normalized URL, and drop undated, stale or future ones."""
    merged = dict(store)
    for article in fresh:
        merged[normalize_url(article.url)] = article
    oldest = now - timedelta(hours=WINDOW_HOURS)
    latest = now + _FUTURE_SLACK
    return {
        key: a for key, a in merged.items()
        if a.published_at is not None and oldest <= a.published_at <= latest
    }


def _strip_outlet(title: str) -> str:
    return _OUTLET_SUFFIX.sub("", title).strip()


def _title_key(title: str) -> str:
    return " ".join(_PUNCT.sub("", _strip_outlet(title).casefold()).split())


def _dedupe_titles(articles: list[Article]) -> list[Article]:
    newest: dict[str, Article] = {}
    for a in articles:
        key = _title_key(a.title)
        kept = newest.get(key)
        if kept is None or a.published_at > kept.published_at:
            newest[key] = a
    return list(newest.values())


def _coverage_hours(store: dict[str, Article], now: datetime) -> int:
    oldest: dict[str, datetime] = {}
    for a in store.values():
        if a.published_at is not None and (a.source not in oldest or a.published_at < oldest[a.source]):
            oldest[a.source] = a.published_at
    if not oldest:
        return 1
    depths = [int((now - t).total_seconds() // 3600) for t in oldest.values()]
    return max(1, min(WINDOW_HOURS, int(statistics.median(depths))))


def _tier(n: int, cutoffs: Cutoffs) -> Tier:
    if n >= cutoffs.high:
        return "high"
    if n >= cutoffs.elevated:
        return "elevated"
    if n >= cutoffs.active:
        return "active"
    return "quiet"


def _content_words(title: str, own_terms: set[str]) -> set[str]:
    return {
        w for w in _WORD.findall(title.lower())
        if len(w) >= 3 and w not in _STOPWORDS and w not in own_terms
    }


def _blurb(article: Article, headline: str) -> str | None:
    snippet = " ".join(article.snippet.split())
    if not snippet or _title_key(snippet) == _title_key(article.title) or _title_key(snippet) == _title_key(headline):
        return None
    sentence = _SENTENCE_END.split(snippet, maxsplit=1)[0]
    words = sentence.split()
    if len(words) > _BLURB_WORDS:
        return " ".join(words[:_BLURB_WORDS]) + "…"
    return sentence


def _story(iso2: str, articles: list[Article]) -> Story:
    own = country_terms(iso2)
    words = [_content_words(a.title, own) for a in articles]
    best_i, best_key = 0, None
    for i, a in enumerate(articles):
        score = sum(len(words[i] & words[j]) for j in range(len(articles)) if j != i)
        key = (score, a.published_at)
        if best_key is None or key > best_key:
            best_i, best_key = i, key
    pick = articles[best_i]
    headline = _strip_outlet(pick.title)
    return Story(
        headline=headline,
        blurb=_blurb(pick, headline),
        article=StoryArticle(title=pick.title, url=pick.url, outlet=pick.source,
                             published_at=pick.published_at, image_url=pick.image_url),
    )


def build_snapshot(store: dict[str, Article], feeds: int, now: datetime) -> Hotspots:
    coverage = _coverage_hours(store, now)
    articles = _dedupe_titles([a for a in store.values() if a.published_at is not None])
    cutoffs = cutoffs_for(len(articles))

    members: dict[str, list[Article]] = defaultdict(list)
    shared: Counter[tuple[str, str]] = Counter()
    for a in articles:
        named = sorted(countries_named(f"{a.title} {a.snippet}"))
        for iso2 in named:
            members[iso2].append(a)
        shared.update(combinations(named, 2))
    partners: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for (x, y), count in shared.items():
        if count >= _MIN_SHARED_FOR_WITH:
            partners[x].append((count, y))
            partners[y].append((count, x))

    heat: list[CountryHeat] = []
    for iso2, items in members.items():
        country = COUNTRIES[iso2]
        hourly = [0] * coverage
        for a in items:
            hours_back = max(0, int((now - a.published_at).total_seconds() // 3600))
            idx = coverage - 1 - hours_back
            if 0 <= idx < coverage:
                hourly[idx] += 1
        tier = _tier(len(items), cutoffs)
        top = sorted(partners.get(iso2, []), key=lambda p: (-p[0], p[1]))[:_MAX_WITH]
        heat.append(CountryHeat(
            iso2=iso2, iso_numeric=country.iso_numeric, name=country.name, n=len(items), tier=tier,
            hourly=hourly, with_=[p[1] for p in top],
            story=None if tier == "quiet" else _story(iso2, items),
        ))
    heat.sort(key=lambda c: (-c.n, c.name))
    return Hotspots(generated_at=now, coverage_hours=coverage, total_articles=len(articles),
                    feeds=feeds, cutoffs=cutoffs, countries=heat)
