"""Shared helpers for source modules: tolerant HTTP JSON calls that never raise,
Article construction, date parsing to UTC, text cleanup, and plan keyword matching."""

from __future__ import annotations

import email.utils
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

from backend.config import settings
from backend.focus_terms import keyword_hit
from backend.models import Article, SourceType
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.ingestion")

USER_AGENT = "AtlasBrief/1.0 (+https://github.com/cwlau77/atlas_brief)"

_TAG = re.compile(r"<[^>]+>")
_COMPACT_FORMATS = ("%Y%m%dT%H%M%SZ", "%Y%m%dT%H%M%S")


def parse_datetime(value: Any) -> datetime | None:
    """Parse ISO-8601, RFC-822, compact GDELT/Alpha Vantage, epoch seconds or a datetime into UTC."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    for fmt in _COMPACT_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = email.utils.parsedate_to_datetime(text)
        except (TypeError, ValueError, IndexError):
            return None
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def clean_text(value: Any, limit: int = 1000) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(_TAG.sub(" ", value).split())[:limit]


def dict_items(value: Any) -> list[dict]:
    """The dict entries of a JSON list; anything else (missing, wrong type) is empty."""
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def make_article(source_type: SourceType, *, title: Any, url: Any, outlet: str, snippet: Any = None,
                 published_at: Any = None, country: str | None = None) -> Article | None:
    """Build an Article from raw upstream fields, or None when the title or URL is missing.

    Every source goes through here, so titles and snippets are cleaned the same
    way everywhere and a missing snippet always falls back to the title.
    """
    title = clean_text(title)
    url = url.strip() if isinstance(url, str) else ""
    if not title or not url:
        return None
    return Article(
        title=title,
        snippet=clean_text(snippet) or title,
        url=url,
        source=outlet,
        published_at=parse_datetime(published_at),
        country=country,
        raw_source_type=source_type,
    )


def outlet_from_url(url: str) -> str:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def lookback_start(hours: float | None = None) -> datetime:
    window = settings.hours_lookback if hours is None else hours
    return datetime.now(timezone.utc) - timedelta(hours=max(window, 1))


def matches_plan(text: str, plan: SearchPlan) -> bool:
    return keyword_hit(text, plan.match_terms)


def sub_request_timeout() -> httpx.Timeout:
    """Per-request timeout for sources that issue several requests inside one
    source budget (asyncio.wait_for(source_timeout_seconds) in the registry).
    Leaves 2s of margin so one slow/hung request fails on its own, caught and
    skipped, instead of consuming the whole budget and wiping every request's
    results, including ones that already came back."""
    return httpx.Timeout(max(1.0, settings.source_timeout_seconds - 2))


def _decode(resp: httpx.Response, source: str) -> Any | None:
    if resp.status_code == 429:
        logger.warning("source=%s status=rate_limited", source)
        return None
    if resp.status_code >= 400:
        logger.warning("source=%s status=http_%d", source, resp.status_code)
        return None
    try:
        return resp.json()
    except ValueError:
        logger.warning("source=%s status=malformed", source)
        return None


async def get_json(client: httpx.AsyncClient, url: str, *, source: str,
                   params: dict | None = None, headers: dict | None = None,
                   timeout: httpx.Timeout | float | None = None) -> Any | None:
    kwargs: dict[str, Any] = {"params": params, "headers": headers}
    if timeout is not None:
        kwargs["timeout"] = timeout
    try:
        resp = await client.get(url, **kwargs)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)


async def post_json(client: httpx.AsyncClient, url: str, *, source: str,
                    json_body: dict, headers: dict | None = None,
                    timeout: httpx.Timeout | float | None = None) -> Any | None:
    kwargs: dict[str, Any] = {"json": json_body, "headers": headers}
    if timeout is not None:
        kwargs["timeout"] = timeout
    try:
        resp = await client.post(url, **kwargs)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)
