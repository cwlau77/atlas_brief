"""Wikimedia Commons file photos: a place picture for items with no outlet image.

Per place, the first candidate is the place's own English Wikipedia lead image (its
`pageimage`), then a Commons search biased towards views of the place. The top raw search
hit for a place name is often unrelated (a church mosaic on a war alert), so the search only
fills in. Commons images show the place, not the event, so the frontend credits them as file photos.
A cold Commons search can take seconds, so a query keeps its lead image when the search overruns
the budget, and the overrun lookup finishes in the background to fill the cache.
"""
import asyncio
import logging
import re
import time
from html import unescape
from typing import Optional

import httpx

from ..ingestion.common import USER_AGENT
from ..models import Briefing, CommonsImage, KeyDevelopment

log = logging.getLogger(__name__)

API_URL = "https://commons.wikimedia.org/w/api.php"
WIKI_URL = "https://en.wikipedia.org/w/api.php"
TTL_S = 24 * 3600
MIN_WIDTH = 640
MAX_AUTHOR = 120
MIMES = {"image/jpeg", "image/png", "image/webp"}
IMAGEINFO = {"prop": "imageinfo", "iiprop": "url|extmetadata|mime|size", "iiurlwidth": 800}
SEARCH_BIAS = "skyline OR cityscape OR panorama OR street"
# Whole words, so "Mapleton" and "Chartres" pass. "seal of", not "seal": "Seal Beach" is a place.
DENY = re.compile(r"\b(flag|map|coats? of arms|logo|diagram|locator|seals? of|emblem|chart)s?\b", re.I)
TAG = re.compile(r"<[^>]+>")

BACKFILL_S = 10.0

_cache: dict[str, tuple[float, list[CommonsImage]]] = {}
_sem = asyncio.Semaphore(4)
_backfilling: set[str] = set()  # queries with a backfill in flight
_tasks: set[asyncio.Task] = set()  # strong refs so running backfills aren't garbage-collected


def query_for(dev: KeyDevelopment) -> Optional[str]:
    if dev.place and dev.place.name:
        return dev.place.name
    if dev.regions:
        return dev.regions[0]
    return None


def _meta(info: dict, key: str) -> str:
    raw = (info.get("extmetadata") or {}).get(key, {}).get("value", "")
    return re.sub(r"\s+", " ", unescape(TAG.sub("", str(raw)))).strip()


def _parse(data: dict) -> list[CommonsImage]:
    pages = (data.get("query") or {}).get("pages") or {}
    out: list[CommonsImage] = []
    for page in pages.values():
        title = page.get("title", "")
        infos = page.get("imageinfo") or []
        if not infos or DENY.search(title.replace("_", " ")):
            continue
        info = infos[0]
        if info.get("mime") not in MIMES or (info.get("width") or 0) < MIN_WIDTH:
            continue
        author, lic = _meta(info, "Artist"), _meta(info, "LicenseShortName")
        url = info.get("thumburl") or info.get("url")
        # An overlong author is usually a pasted description, not a credit: skip, never truncate.
        if not (author and lic and url) or len(author) > MAX_AUTHOR:
            continue
        out.append(CommonsImage(
            url=url, page_url=info.get("descriptionurl") or url, author=author, license=lic,
        ))
    return out


async def _get(url: str, params: dict, client: httpx.AsyncClient) -> dict:
    async with _sem:
        resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.json()


async def _lead_image(query: str, client: httpx.AsyncClient) -> list[CommonsImage]:
    """The place article's lead image, through the same filters as search hits."""
    data = await _get(WIKI_URL, {
        "action": "query", "prop": "pageimages", "piprop": "name", "titles": query,
        "redirects": 1, "format": "json",
    }, client)
    pages = (data.get("query") or {}).get("pages") or {}
    name = next((p["pageimage"] for p in pages.values() if p.get("pageimage")), None)
    if not name:
        return []
    return _parse(await _get(API_URL, {"action": "query", "format": "json", "titles": f"File:{name}", **IMAGEINFO}, client))


async def _search(query: str, client: httpx.AsyncClient) -> list[CommonsImage]:
    return _parse(await _get(API_URL, {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"{query} {SEARCH_BIAS} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 8,
        **IMAGEINFO,
    }, client))


def _merge(*steps: object) -> list[CommonsImage]:
    """Images from the steps that succeeded, in order, deduped by URL."""
    out: list[CommonsImage] = []
    for step in steps:
        for img in step if isinstance(step, list) else []:
            if all(img.url != o.url for o in out):
                out.append(img)
    return out


async def _lookup(query: str, client: httpx.AsyncClient) -> tuple[list[CommonsImage], bool]:
    """Lead image first, then search hits, deduped. Both run at once. Also returns whether
    every step succeeded (a partial result is used but not cached). Raises if both fail."""
    lead, hits = await asyncio.gather(_lead_image(query, client), _search(query, client), return_exceptions=True)
    if isinstance(lead, BaseException) and isinstance(hits, BaseException):
        raise lead
    for exc in (lead, hits):
        if isinstance(exc, BaseException):
            log.info("commons lookup step failed for %r: %s", query, exc)
    return _merge(lead, hits), isinstance(lead, list) and isinstance(hits, list)


def _new_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=3.0, headers={"User-Agent": USER_AGENT})


async def _backfill(query: str) -> None:
    """Finish an overrun lookup on its own client so the next briefing on this place gets the
    full list from the cache. Never raises."""
    try:
        async with _new_client() as client:
            found, complete = await asyncio.wait_for(_lookup(query, client), BACKFILL_S)
        if complete:
            _cache[query] = (time.monotonic(), found)
    except Exception as exc:
        log.info("commons backfill failed for %r: %s", query, exc)
    finally:
        _backfilling.discard(query)


def _schedule_backfill(query: str) -> None:
    if query in _backfilling or query in _cache:
        return
    _backfilling.add(query)
    task = asyncio.create_task(_backfill(query))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def fetch_candidates(
    queries: list[str], client: httpx.AsyncClient, budget_s: float = 1.5
) -> dict[str, list[CommonsImage]]:
    """Candidate photos per query. A query keeps whatever arrived inside the budget (often just
    the lead image); one that overran is finished in the background for the cache. Never raises."""
    unique = list(dict.fromkeys(q for q in queries if q))
    result: dict[str, list[CommonsImage]] = {q: [] for q in unique}
    done: set[str] = set()
    now = time.monotonic()

    async def one(q: str) -> None:
        hit = _cache.get(q)
        if hit and now - hit[0] < TTL_S:
            result[q] = hit[1]
            done.add(q)
            return
        lead_task = asyncio.create_task(_lead_image(q, client))
        search_task = asyncio.create_task(_search(q, client))
        try:
            lead = await asyncio.gather(lead_task, return_exceptions=True)
            result[q] = _merge(*lead)
            hits = await asyncio.gather(search_task, return_exceptions=True)
        except asyncio.CancelledError:
            lead_task.cancel()
            search_task.cancel()
            raise
        steps = [*lead, *hits]
        for exc in steps:
            if isinstance(exc, BaseException):
                log.info("commons lookup step failed for %r: %s", q, exc)
        result[q] = _merge(*steps)
        if all(isinstance(s, list) for s in steps):
            _cache[q] = (time.monotonic(), result[q])
        done.add(q)

    try:
        await asyncio.wait_for(asyncio.gather(*(one(q) for q in unique)), budget_s)
    except asyncio.TimeoutError:
        log.info("commons lookup exceeded %.1fs budget", budget_s)
        for q in unique:
            if q not in done:
                _schedule_backfill(q)
    except Exception as exc:
        log.info("commons lookup failed: %s", exc)
    return result


def assign_images(briefing: Briefing, candidates: dict[str, list[CommonsImage]]) -> None:
    """Fill commons_image in place, never the same photo twice. Developments first, then alerts
    borrowing a development's place. Within each, items with no outlet photo pick first; items
    with one get what's left as a fallback for when the outlet photo fails to load."""
    used: set[str] = set()

    def take(query: Optional[str]) -> Optional[CommonsImage]:
        for cand in candidates.get(query or "", []):
            if cand.url not in used:
                used.add(cand.url)
                return cand
        return None

    def bare_first(items):
        return sorted(items, key=lambda item: any(s.image_url for s in item.sources))

    for dev in bare_first(briefing.key_developments):
        dev.commons_image = take(query_for(dev))

    for alert in bare_first(briefing.priority_alerts):
        urls = {s.url for s in alert.sources}
        for dev in briefing.key_developments:
            if urls & {s.url for s in dev.sources}:
                alert.commons_image = take(query_for(dev))
                break
