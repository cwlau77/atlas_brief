import asyncio
import time

import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import rss_source
from backend.ingestion.rss_source import RSS_FEEDS, _parse_feed
from backend.search_plan import SearchPlan

FIXTURE = """<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>Trade tariffs escalate between blocs</title><link>https://f.com/1</link><description>Tariff rise.</description></item>
<item><title>Celebrity gala photos</title><link>https://f.com/2</link><description>Red carpet.</description></item>
</channel></rss>"""


def test_parse_feed_filters_by_keywords():
    arts = _parse_feed("Fixture", FIXTURE, ["tariff", "tariffs", "trade"])  # feedparser accepts raw strings
    assert [a.url for a in arts] == ["https://f.com/1"]


def test_parse_feed_returns_empty_when_nothing_matches():
    # No permissive fallback — regression guard for the "only-Iran" bug.
    assert _parse_feed("Fixture", FIXTURE, ["volcano"]) == []


def test_feed_list_covers_non_western_outlets():
    outlets = {name for name, _ in RSS_FEEDS}
    assert len(outlets) >= 8
    assert {"The Hindu", "Deutsche Welle", "France 24", "AllAfrica", "Straits Times"} <= outlets


def test_feed_list_covers_major_us_outlets():
    outlets = {name for name, _ in RSS_FEEDS}
    assert {"CNN World", "Fox News World", "New York Times World",
            "Washington Post World", "ABC News International", "CBS News World"} <= outlets


def test_feed_list_covers_us_tech_and_finance_desks():
    outlets = {name for name, _ in RSS_FEEDS}
    assert len(outlets & {"NPR News", "New York Times U.S.", "New York Times Technology",
                          "Washington Post Technology", "Axios", "Politico", "The Verge",
                          "Ars Technica", "Wired"}) >= 6
    assert len(outlets & {"MarketWatch", "CNBC Top News", "Yahoo Finance",
                          "Investing.com", "Financial Times"}) >= 3


@pytest.mark.asyncio
@respx.mock
async def test_one_slow_feed_does_not_starve_the_whole_source_budget(monkeypatch):
    # The real server for "Slow" would take 10s to respond -- far longer than
    # the per-source budget. Each feed request's own timeout (read from the
    # extensions respx hands the mock transport) must bound how long we wait
    # on it, so the slow feed fails on its own and the fast feed's result
    # still comes back inside the overall per-source budget below.
    monkeypatch.setattr(settings, "source_timeout_seconds", 3.0)
    monkeypatch.setattr(rss_source, "RSS_FEEDS", [
        ("Slow", "https://slow.example/feed"),
        ("Fast", "https://fast.example/feed"),
    ])

    async def slow_effect(request):
        read_timeout = (request.extensions.get("timeout") or {}).get("read") or 10.0
        try:
            await asyncio.wait_for(asyncio.sleep(10.0), timeout=read_timeout)
        except asyncio.TimeoutError:
            raise httpx.ReadTimeout("simulated slow feed")
        return httpx.Response(200, text=FIXTURE)

    respx.get("https://slow.example/feed").mock(side_effect=slow_effect)
    respx.get("https://fast.example/feed").mock(return_value=httpx.Response(200, text=FIXTURE))

    plan = SearchPlan(phrase="x", queries=["x"], must_terms=["tariff"])
    async with httpx.AsyncClient(timeout=settings.source_timeout_seconds) as client:
        start = time.monotonic()
        articles = await asyncio.wait_for(rss_source.fetch(plan, client), timeout=settings.source_timeout_seconds)
        elapsed = time.monotonic() - start

    assert [a.url for a in articles] == ["https://f.com/1"]
    assert elapsed < settings.source_timeout_seconds - 0.5
