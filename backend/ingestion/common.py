"""Shared helpers for source modules: tolerant HTTP JSON calls that never raise,
date parsing to UTC, text cleanup, and plan keyword matching."""

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
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.ingestion")

USER_AGENT = "AtlasBrief/1.0 (+https://github.com/cwlau77/atlas_brief)"

_TAG = re.compile(r"<[^>]+>")
_COMPACT_FORMATS = ("%Y%m%dT%H%M%SZ", "%Y%m%dT%H%M%S")


def parse_datetime(value: Any) -> datetime | None:
    """Parse ISO-8601, RFC-822, compact GDELT/Alpha Vantage, or epoch seconds into UTC."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
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
                   params: dict | None = None, headers: dict | None = None) -> Any | None:
    try:
        resp = await client.get(url, params=params, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)


async def post_json(client: httpx.AsyncClient, url: str, *, source: str,
                    json_body: dict, headers: dict | None = None) -> Any | None:
    try:
        resp = await client.post(url, json=json_body, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)
