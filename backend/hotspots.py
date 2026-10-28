"""Hotspots snapshot: per-country article counts over the last 24 hours of world-desk feeds.

Pure building lives here (no I/O, no LLM); the cache and images are layered on top.
"""
from __future__ import annotations

import asyncio
import logging
import math
import re
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from backend.config import settings
from backend.hotspots_feeds import fetch_world_desks
from backend.hotspots_match import COUNTRIES, countries_named, country_terms
from backend.ingestion.common import USER_AGENT
from backend.models import Article
from backend.processing.urls import normalize_url
from backend.synthesis.commons import fetch_candidates

logger = logging.getLogger("briefing.hotspots")

WINDOW_HOURS = 24
_FUTURE_SLACK = timedelta(minutes=10)
_MIN_SHARED_FOR_WITH = 3
_MAX_WITH = 3
_BLURB_WORDS = 30
FAILURE_TTL_SECONDS = 300
COMMONS_BUDGET_S = 2.0
COMMONS_CREDIT = "File photo · Wikimedia Commons"
BUILD_DEADLINE_S = 45.0  # a trickling feed must not hold the rebuild (and its lock) forever

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
_SENTENCE_END = re.compile(r"[.!?]\s+(?=[^\W\d_])")
# A dot that ends one of these does not end the sentence: U.S., U.K., J. Smith, Mr. Netanyahu.
_INITIALISM = re.compile(r"(?:[A-Z]\.)+")
_TITLES = frozenset("Mr Mrs Ms Dr Gen Sen Gov St Prof Rep Lt Col".split())


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
    """Any trailing " - Outlet" segment; loose, for dedupe keys only."""
    return _OUTLET_SUFFIX.sub("", title).strip()


def _strip_own_outlet(title: str, outlet: str) -> str:
    """The headline word for word, minus a trailing " - Outlet" only when it names its own outlet."""
    m = _OUTLET_SUFFIX.search(title)
    if m and m.group(0).strip().lstrip("-–—|").strip().casefold() == outlet.strip().casefold():
        return title[: m.start()].strip()
    return title.strip()


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


def _first_sentence(text: str) -> str:
    for m in _SENTENCE_END.finditer(text):
        if not text[m.end()].isupper():
            continue
        if text[m.start()] == ".":
            token = text[: m.start() + 1].rsplit(None, 1)[-1].lstrip("(\"'“‘")
            if _INITIALISM.fullmatch(token) or token[:-1] in _TITLES:
                continue
        return text[: m.start() + 1]
    return text


def _blurb(article: Article, headline: str) -> str | None:
    snippet = " ".join(article.snippet.split())
    if not snippet or _title_key(snippet) == _title_key(article.title) or _title_key(snippet) == _title_key(headline):
        return None
    sentence = _first_sentence(snippet)
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
    headline = _strip_own_outlet(pick.title, pick.source)
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


# --- Cache -------------------------------------------------------------------------------------
# One process only (see main.py). The store keeps the last 24h of articles between rebuilds so a
# desk that fails once does not empty its countries; the snapshot is rebuilt from it.

_store: dict[str, Article] = {}
_snapshot: tuple[Hotspots, float] | None = None  # (snapshot, monotonic expiry)
_lock = asyncio.Lock()
_rebuild_task: asyncio.Task | None = None
_tasks: set[asyncio.Task] = set()  # strong refs so a running rebuild isn't garbage-collected
_retry_after = 0.0  # monotonic time before which a failed rebuild is not retried


def reset_cache() -> None:
    global _snapshot, _rebuild_task, _retry_after
    _store.clear()
    _snapshot = None
    _rebuild_task = None
    _retry_after = 0.0
    _tasks.clear()


async def _attach_images(snapshot: Hotspots, client: httpx.AsyncClient) -> None:
    """The article's own photo wins; stories without one get a Commons photo within one shared budget."""
    stories = [c.story for c in snapshot.countries if c.story is not None]
    missing: list[Story] = []
    for story in stories:
        if story.article.image_url:
            story.image = StoryImage(url=story.article.image_url, credit=story.article.outlet)
        else:
            missing.append(story)
    if not missing or not settings.commons_images_enabled:
        return
    found = await fetch_candidates([s.headline for s in missing], client, COMMONS_BUDGET_S)
    for story in missing:
        candidates = found.get(story.headline) or []
        if candidates:
            story.image = StoryImage(url=candidates[0].url, credit=COMMONS_CREDIT)


async def _build() -> Hotspots | None:
    """Fetch, merge, build and add photos. None when the desks gave nothing to build from."""
    async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
        fresh, feeds = await fetch_world_desks(client)
        if not fresh:
            return None
        now = datetime.now(timezone.utc)
        store = merge_store(_store, fresh, now)
        if not store:
            return None
        snapshot = build_snapshot(store, feeds, now)
        await _attach_images(snapshot, client)
    _store.clear()
    _store.update(store)
    return snapshot


async def _refresh() -> Hotspots | None:
    """Rebuild and cache; on failure keep whatever snapshot there is and back off."""
    global _snapshot, _retry_after
    try:
        snapshot = await asyncio.wait_for(_build(), BUILD_DEADLINE_S)
    except Exception as exc:  # a feed or parse failure must never take the page down
        logger.warning("hotspots status=failed detail=%s", type(exc).__name__)
        snapshot = None
    if snapshot is None:
        _retry_after = time.monotonic() + FAILURE_TTL_SECONDS
        return None
    _snapshot = (snapshot, time.monotonic() + settings.hotspots_ttl_minutes * 60)
    _retry_after = 0.0
    return snapshot


def _start_background_rebuild() -> None:
    global _rebuild_task
    if _rebuild_task is not None and not _rebuild_task.done():
        return
    task = asyncio.create_task(_refresh())
    _rebuild_task = task
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def get_hotspots() -> Hotspots | None:
    """The cached snapshot. Past its age it is still served while one background rebuild runs;
    with none at all the first caller builds it and the rest wait. None when it cannot be built."""
    cached = _snapshot
    if cached is not None:
        if cached[1] <= time.monotonic() and time.monotonic() >= _retry_after:
            _start_background_rebuild()
        return cached[0]
    async with _lock:
        if _snapshot is not None:
            return _snapshot[0]
        if time.monotonic() < _retry_after:
            return None
        return await _refresh()
