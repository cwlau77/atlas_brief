"""Wikimedia Commons file photos: a place picture for items with no outlet image.

Commons images show the place, not the event, so the frontend credits them as file photos.
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
TTL_S = 24 * 3600
MIN_WIDTH = 640
MIMES = {"image/jpeg", "image/png", "image/webp"}
DENY = re.compile(r"flag|map|coat of arms|coat_of_arms|logo|diagram|locator|seal|emblem|chart", re.I)
TAG = re.compile(r"<[^>]+>")

_cache: dict[str, tuple[float, list[CommonsImage]]] = {}
_sem = asyncio.Semaphore(4)


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
        if not infos or DENY.search(title):
            continue
        info = infos[0]
        if info.get("mime") not in MIMES or (info.get("width") or 0) < MIN_WIDTH:
            continue
        author, lic = _meta(info, "Artist"), _meta(info, "LicenseShortName")
        url = info.get("thumburl") or info.get("url")
        if not (author and lic and url):
            continue
        out.append(CommonsImage(
            url=url, page_url=info.get("descriptionurl") or url, author=author, license=lic,
        ))
    return out


async def _search(query: str, client: httpx.AsyncClient) -> list[CommonsImage]:
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": f"{query} filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 8,
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size", "iiurlwidth": 800,
    }
    async with _sem:
        resp = await client.get(API_URL, params=params, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return _parse(resp.json())


async def fetch_candidates(
    queries: list[str], client: httpx.AsyncClient, budget_s: float = 1.5
) -> dict[str, list[CommonsImage]]:
    """Candidate photos per query. Failed or timed-out queries map to []. Never raises."""
    unique = list(dict.fromkeys(q for q in queries if q))
    result: dict[str, list[CommonsImage]] = {q: [] for q in unique}
    now = time.monotonic()

    async def one(q: str) -> None:
        hit = _cache.get(q)
        if hit and now - hit[0] < TTL_S:
            result[q] = hit[1]
            return
        try:
            found = await _search(q, client)
        except Exception as exc:
            log.info("commons lookup failed for %r: %s", q, exc)
            return
        _cache[q] = (time.monotonic(), found)
        result[q] = found

    try:
        await asyncio.wait_for(asyncio.gather(*(one(q) for q in unique)), budget_s)
    except asyncio.TimeoutError:
        log.info("commons lookup exceeded %.1fs budget", budget_s)
    except Exception as exc:
        log.info("commons lookup failed: %s", exc)
    return result


def assign_images(briefing: Briefing, candidates: dict[str, list[CommonsImage]]) -> None:
    """Fill commons_image in place. Developments first, then alerts borrowing a development's place."""
    used: set[str] = set()

    def take(query: Optional[str]) -> Optional[CommonsImage]:
        for cand in candidates.get(query or "", []):
            if cand.url not in used:
                used.add(cand.url)
                return cand
        return None

    def has_outlet_image(item) -> bool:
        return any(s.image_url for s in item.sources)

    for dev in briefing.key_developments:
        if not has_outlet_image(dev):
            dev.commons_image = take(query_for(dev))

    for alert in briefing.priority_alerts:
        if has_outlet_image(alert):
            continue
        urls = {s.url for s in alert.sources}
        for dev in briefing.key_developments:
            if urls & {s.url for s in dev.sources}:
                alert.commons_image = take(query_for(dev))
                break
