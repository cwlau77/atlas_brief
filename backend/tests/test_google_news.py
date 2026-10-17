import httpx
import pytest
import respx

from backend.ingestion import google_news_source
from backend.ingestion.google_news_source import GOOGLE_NEWS_SEARCH, fetch
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

FEED = """<?xml version="1.0"?><rss version="2.0"><channel><title>Google News</title>
<item><title>States push data center privacy rules - Reuters</title>
<link>https://news.google.com/rss/articles/abc</link>
<pubDate>Fri, 16 Oct 2026 14:30:00 GMT</pubDate>
<description>&lt;a href="x"&gt;States push data center privacy rules&lt;/a&gt;</description>
<source url="https://www.reuters.com">Reuters</source></item>
</channel></rss>"""

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale privacy"], country="US")


@pytest.mark.asyncio
@respx.mock
async def test_parses_items_and_strips_outlet_suffix():
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert route.call_count == 2  # one request per plan query
    a = articles[0]
    assert a.title == "States push data center privacy rules"
    assert a.source == "Reuters"
    assert a.raw_source_type == "google_news"
    assert a.published_at.isoformat() == "2026-10-16T14:30:00+00:00"
    params = route.calls[0].request.url.params
    assert params["gl"] == "US" and params["ceid"] == "US:en"
    assert params["q"].endswith("when:7d")


@pytest.mark.asyncio
@respx.mock
async def test_country_defaults_to_us_and_gb_is_used():
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        await fetch(SearchPlan(phrase="housing", queries=["housing"], country="GB"), client)
        await fetch(SearchPlan(phrase="housing", queries=["housing"]), client)
    assert route.calls[0].request.url.params["gl"] == "GB"
    assert route.calls[1].request.url.params["hl"] == "en-US"


@pytest.mark.asyncio
@respx.mock
async def test_http_error_returns_empty():
    respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(503))
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []


@pytest.mark.asyncio
@respx.mock
async def test_quota_exhausted_skips_requests(monkeypatch):
    monkeypatch.setattr(google_news_source.quota, "take", lambda source, n=1: False)
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []
    assert route.call_count == 0


def test_registered():
    assert "google_news" in {s.name for s in SOURCES}
