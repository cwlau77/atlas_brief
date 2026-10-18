from datetime import timezone

import httpx
import pytest
import respx

import backend.ingestion.gdelt_source as gdelt_module
from backend.config import settings
from backend.ingestion.gdelt_source import GDELT_DOC_API, fetch
from backend.search_plan import SearchPlan

PLAN = SearchPlan(phrase="border clash", queries=["border clash"])

GDELT_PAYLOAD = {
    "articles": [
        {"title": "Border clash reported", "url": "https://ex.com/1",
         "domain": "ex.com", "sourcecountry": "India", "seendate": "20260706T101500Z"},
    ]
}


@pytest.fixture(autouse=True)
def _fast_pacer(monkeypatch):
    # Keep tests independent of the process-global pacer state and real 5.5s spacing.
    monkeypatch.setattr(settings, "gdelt_min_interval_seconds", 0.0, raising=False)
    monkeypatch.setattr(gdelt_module, "_last_request_at", 0.0, raising=False)


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_dates_are_utc_aware():
    respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(200, json=GDELT_PAYLOAD))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert len(articles) == 1
    assert articles[0].published_at.tzinfo == timezone.utc


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_gives_up_immediately_on_429():
    # A 5.5 s retry can't fit the 8 s source budget, so a 429 must return
    # empty at once instead of burning the whole budget on a doomed retry.
    route = respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(429))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert articles == []
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_concurrent_requests_are_paced(monkeypatch):
    import asyncio
    import time

    monkeypatch.setattr(settings, "gdelt_min_interval_seconds", 0.3)
    respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(200, json=GDELT_PAYLOAD))
    start = time.monotonic()
    async with httpx.AsyncClient() as client:
        await asyncio.gather(fetch(PLAN, client), fetch(PLAN, client))
    assert time.monotonic() - start >= 0.3  # second call waited for the pacer


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_uses_best_query_country_filter_and_drops_short_terms():
    route = respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(200, json=GDELT_PAYLOAD))
    plan = SearchPlan(phrase="ai data centers", queries=['ai "data centers"'], country="GB")
    async with httpx.AsyncClient() as client:
        await fetch(plan, client)
    query = route.calls[0].request.url.params["query"]
    assert '"data centers"' in query
    assert "sourcecountry:UK" in query
    assert " ai " not in f" {query} "  # GDELT rejects terms shorter than 3 characters
