import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import newsapi_source
from backend.ingestion.newsapi_source import NEWSAPI_EVERYTHING, fetch
from backend.search_plan import SearchPlan

PAYLOAD = {"totalResults": 1, "articles": [
    {"title": "Tariff talks stall", "description": "Negotiations pause.",
     "url": "https://ex.com/t", "source": {"name": "ExWire"},
     "publishedAt": "2026-07-06T09:00:00Z"}]}

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale"])


@pytest.mark.asyncio
@respx.mock
async def test_key_sent_as_header_and_queries_ored(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", "sekrit")
    route = respx.get(NEWSAPI_EVERYTHING).mock(return_value=httpx.Response(200, json=PAYLOAD))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert len(articles) == 1 and articles[0].raw_source_type == "newsapi"
    assert articles[0].published_at.tzinfo is not None
    req = route.calls[0].request
    assert req.headers.get("X-Api-Key") == "sekrit"
    assert "sekrit" not in str(req.url)
    assert req.url.params["q"] == '("data centers" AND privacy) OR (hyperscale)'


@pytest.mark.asyncio
async def test_missing_key_disables_source(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", None)
    assert newsapi_source.enabled() is False
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []
