import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion.newsapi_source import NEWSAPI_EVERYTHING, fetch_newsapi

PAYLOAD = {"totalResults": 1, "articles": [
    {"title": "Tariff talks stall", "description": "Negotiations pause.",
     "url": "https://ex.com/t", "source": {"name": "ExWire"},
     "publishedAt": "2026-07-06T09:00:00Z"}]}


@pytest.mark.asyncio
@respx.mock
async def test_key_sent_as_header_not_query(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", "sekrit")
    route = respx.get(NEWSAPI_EVERYTHING).mock(return_value=httpx.Response(200, json=PAYLOAD))
    articles = await fetch_newsapi("trade")
    assert len(articles) == 1
    req = route.calls[0].request
    assert req.headers.get("X-Api-Key") == "sekrit"
    assert "sekrit" not in str(req.url)


@pytest.mark.asyncio
async def test_missing_key_skips_quietly(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", None)
    assert await fetch_newsapi("trade") == []
