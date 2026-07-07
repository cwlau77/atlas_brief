from datetime import timezone

import httpx
import pytest
import respx

import backend.ingestion.gdelt_source as gdelt_module
from backend.config import settings
from backend.ingestion.gdelt_source import GDELT_DOC_API, fetch_gdelt

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
    articles = await fetch_gdelt("border security")
    assert len(articles) == 1
    assert articles[0].published_at.tzinfo == timezone.utc


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_retries_once_on_429(monkeypatch):
    monkeypatch.setattr(gdelt_module, "_GDELT_RETRY_DELAY_SECONDS", 0.0)
    monkeypatch.setattr(gdelt_module.random, "random", lambda: 0.0)
    route = respx.get(GDELT_DOC_API)
    route.side_effect = [httpx.Response(429), httpx.Response(200, json=GDELT_PAYLOAD)]
    articles = await fetch_gdelt("energy")
    assert len(articles) == 1
    assert route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_concurrent_requests_are_paced(monkeypatch):
    import asyncio
    import time

    monkeypatch.setattr(settings, "gdelt_min_interval_seconds", 0.3)
    respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(200, json=GDELT_PAYLOAD))
    start = time.monotonic()
    await asyncio.gather(fetch_gdelt("energy"), fetch_gdelt("energy"))
    assert time.monotonic() - start >= 0.3  # second call waited for the pacer


@pytest.mark.asyncio
@respx.mock
async def test_gdelt_gives_up_after_second_429(monkeypatch):
    monkeypatch.setattr(gdelt_module, "_GDELT_RETRY_DELAY_SECONDS", 0.0)
    monkeypatch.setattr(gdelt_module.random, "random", lambda: 0.0)
    respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(429))
    articles = await fetch_gdelt("energy")
    assert articles == []
