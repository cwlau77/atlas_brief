import json

import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import brave_source, exa_source, tavily_source
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy'], country="US")

BRAVE = {"results": [{"title": "Data center privacy fight", "url": "https://www.example.com/b",
                      "description": "<strong>Data</strong> center story", "page_age": "2026-10-16T08:00:00",
                      "profile": {"name": "Example"}, "meta_url": {"hostname": "www.example.com"},
                      "thumbnail": {"src": "https://img.ex/1.jpg"}}]}
TAVILY = {"results": [{"title": "Privacy and data centers", "url": "https://news.example.org/t",
                       "content": "Story text", "published_date": "Fri, 16 Oct 2026 12:00:00 GMT"}]}
EXA = {"results": [{"title": "Hyperscale privacy concerns", "url": "https://exa.example.net/e",
                    "publishedDate": "2026-10-15T07:00:00.000Z", "image": "https://img.ex/1.jpg"}]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "brave_api_key", "b-key")
    monkeypatch.setattr(settings, "tavily_api_key", "t-key")
    monkeypatch.setattr(settings, "exa_api_key", "e-key")


@pytest.mark.asyncio
@respx.mock
async def test_brave_maps_results_and_uses_header_key(keys):
    route = respx.get(brave_source.BRAVE_NEWS).mock(return_value=httpx.Response(200, json=BRAVE))
    async with httpx.AsyncClient() as client:
        articles = await brave_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type, a.snippet) == ("Example", "brave", "Data center story")
    req = route.calls[0].request
    assert req.headers["X-Subscription-Token"] == "b-key"
    assert "b-key" not in str(req.url)
    assert req.url.params["freshness"] == "pw" and req.url.params["country"] == "US"


@pytest.mark.asyncio
@respx.mock
async def test_tavily_posts_news_topic_with_bearer_key(keys):
    route = respx.post(tavily_source.TAVILY_SEARCH).mock(return_value=httpx.Response(200, json=TAVILY))
    async with httpx.AsyncClient() as client:
        articles = await tavily_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type) == ("news.example.org", "tavily")
    assert a.published_at.isoformat() == "2026-10-16T12:00:00+00:00"
    req = route.calls[0].request
    assert req.headers["Authorization"] == "Bearer t-key"
    body = json.loads(req.content)
    assert body["topic"] == "news" and body["days"] == 7 and body["query"] == '"data centers" privacy'


@pytest.mark.asyncio
@respx.mock
async def test_exa_posts_news_category_with_header_key(keys):
    route = respx.post(exa_source.EXA_SEARCH).mock(return_value=httpx.Response(200, json=EXA))
    async with httpx.AsyncClient() as client:
        articles = await exa_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type, a.snippet) == ("exa.example.net", "exa", a.title)
    req = route.calls[0].request
    assert req.headers["x-api-key"] == "e-key"
    body = json.loads(req.content)
    assert body["category"] == "news" and "startPublishedDate" in body


@pytest.mark.asyncio
@respx.mock
async def test_errors_and_missing_keys(keys, monkeypatch):
    respx.get(brave_source.BRAVE_NEWS).mock(return_value=httpx.Response(500))
    respx.post(tavily_source.TAVILY_SEARCH).mock(return_value=httpx.Response(429))
    respx.post(exa_source.EXA_SEARCH).mock(return_value=httpx.Response(200, text="oops"))
    async with httpx.AsyncClient() as client:
        for module in (brave_source, tavily_source, exa_source):
            assert await module.fetch(PLAN, client) == []
    for key in ("brave_api_key", "tavily_api_key", "exa_api_key"):
        monkeypatch.setattr(settings, key, None)
    assert not any(m.enabled() for m in (brave_source, tavily_source, exa_source))


def test_registered():
    assert {"brave", "tavily", "exa"} <= {s.name for s in SOURCES}


@pytest.mark.asyncio
@respx.mock
async def test_search_sources_map_image_or_none(keys):
    bare_brave = {"results": [{k: v for k, v in BRAVE["results"][0].items() if k != "thumbnail"}]}
    bare_exa = {"results": [{k: v for k, v in EXA["results"][0].items() if k != "image"}]}
    respx.get(brave_source.BRAVE_NEWS).mock(side_effect=[httpx.Response(200, json=BRAVE), httpx.Response(200, json=bare_brave)])
    respx.post(exa_source.EXA_SEARCH).mock(side_effect=[httpx.Response(200, json=EXA), httpx.Response(200, json=bare_exa)])
    async with httpx.AsyncClient() as client:
        assert (await brave_source.fetch(PLAN, client))[0].image_url == "https://img.ex/1.jpg"
        assert (await brave_source.fetch(PLAN, client))[0].image_url is None
        assert (await exa_source.fetch(PLAN, client))[0].image_url == "https://img.ex/1.jpg"
        assert (await exa_source.fetch(PLAN, client))[0].image_url is None
