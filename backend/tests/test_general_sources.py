import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import gnews_source, guardian_source, newsdata_source
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale privacy"], country="US")

GUARDIAN = {"response": {"status": "ok", "results": [
    {"webTitle": "Data centre boom raises privacy fears", "webUrl": "https://www.theguardian.com/a",
     "webPublicationDate": "2026-10-16T09:00:00Z", "fields": {"trailText": "<p>Local opposition grows</p>"}}]}}
GNEWS = {"articles": [
    {"title": "Data centers face privacy scrutiny", "description": "Regulators act.",
     "url": "https://ex.com/g", "publishedAt": "2026-10-16T10:00:00Z", "source": {"name": "ExWire"}}]}
NEWSDATA = {"status": "success", "results": [
    {"title": "Privacy rules for data centers", "description": "New bill.", "link": "https://ex.com/n",
     "pubDate": "2026-10-16 11:00:00", "source_name": "Example News"}]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "guardian_api_key", "g-key")
    monkeypatch.setattr(settings, "gnews_api_key", "gn-key")
    monkeypatch.setattr(settings, "newsdata_api_key", "nd-key")


@pytest.mark.asyncio
@respx.mock
async def test_guardian_maps_results_and_sends_two_queries(keys):
    route = respx.get(guardian_source.GUARDIAN_SEARCH).mock(return_value=httpx.Response(200, json=GUARDIAN))
    async with httpx.AsyncClient() as client:
        articles = await guardian_source.fetch(PLAN, client)
    assert route.call_count == 2
    a = articles[0]
    assert (a.title, a.source, a.raw_source_type) == ("Data centre boom raises privacy fears", "The Guardian", "guardian")
    assert a.snippet == "Local opposition grows"
    assert a.published_at.tzinfo is not None
    params = route.calls[0].request.url.params
    assert params["q"] == '"data centers" AND privacy'
    assert params["order-by"] == "newest" and params["show-fields"] == "trailText"


@pytest.mark.asyncio
@respx.mock
async def test_gnews_maps_results_with_country(keys):
    route = respx.get(gnews_source.GNEWS_SEARCH).mock(return_value=httpx.Response(200, json=GNEWS))
    async with httpx.AsyncClient() as client:
        articles = await gnews_source.fetch(PLAN, client)
    assert articles[0].source == "ExWire" and articles[0].raw_source_type == "gnews"
    params = route.calls[0].request.url.params
    assert params["country"] == "us" and params["lang"] == "en"


@pytest.mark.asyncio
@respx.mock
async def test_newsdata_maps_results_and_truncates_long_query(keys):
    route = respx.get(newsdata_source.NEWSDATA_LATEST).mock(return_value=httpx.Response(200, json=NEWSDATA))
    long_plan = SearchPlan(phrase="x", queries=["é" * 150 + " policy"], country="GB")
    async with httpx.AsyncClient() as client:
        articles = await newsdata_source.fetch(PLAN, client)
        await newsdata_source.fetch(long_plan, client)
    assert articles[0].raw_source_type == "newsdata" and articles[0].source == "Example News"
    assert articles[0].published_at.isoformat() == "2026-10-16T11:00:00+00:00"
    assert len(route.calls[1].request.url.params["q"]) <= 100
    assert route.calls[1].request.url.params["country"] == "gb"


@pytest.mark.asyncio
@respx.mock
async def test_newsdata_error_body_is_empty(keys):
    respx.get(newsdata_source.NEWSDATA_LATEST).mock(
        return_value=httpx.Response(200, json={"status": "error", "results": {"message": "rate limit"}}))
    async with httpx.AsyncClient() as client:
        assert await newsdata_source.fetch(PLAN, client) == []


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("module,url_attr", [
    (guardian_source, "GUARDIAN_SEARCH"), (gnews_source, "GNEWS_SEARCH"), (newsdata_source, "NEWSDATA_LATEST"),
])
async def test_http_errors_and_missing_keys(module, url_attr, keys, monkeypatch):
    respx.get(getattr(module, url_attr)).mock(return_value=httpx.Response(429))
    async with httpx.AsyncClient() as client:
        assert await module.fetch(PLAN, client) == []
    for key in ("guardian_api_key", "gnews_api_key", "newsdata_api_key"):
        monkeypatch.setattr(settings, key, None)
    assert module.enabled() is False


def test_registered():
    assert {"guardian", "gnews", "newsdata"} <= {s.name for s in SOURCES}
