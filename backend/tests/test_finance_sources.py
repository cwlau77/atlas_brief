import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import alphavantage_source, finnhub_source, marketaux_source
from backend.ingestion.registry import SOURCES, ingest
from backend.search_plan import SearchPlan, rule_plan

FIN = SearchPlan(phrase="nvidia earnings ai chip stocks", queries=["nvidia earnings"],
                 must_terms=["nvidia", "earnings"], domains=["finance"], tickers=["NVDA"], country="US")
TOPIC_ONLY = SearchPlan(phrase="inflation outlook", queries=["inflation outlook"],
                        must_terms=["inflation"], domains=["finance"])

FINNHUB_MARKET = [
    {"headline": "Nvidia earnings beat estimates", "summary": "Chip demand.", "url": "https://ex.com/f1",
     "datetime": 1792161000, "source": "Reuters"},
    {"headline": "Oil prices slip", "summary": "Crude falls.", "url": "https://ex.com/f2",
     "datetime": 1792161000, "source": "Reuters"},
]
FINNHUB_COMPANY = [{"headline": "NVDA guidance raised", "summary": "Outlook.", "url": "https://ex.com/f3",
                    "datetime": 1792161000, "source": "Yahoo"}]
MARKETAUX = {"data": [{"title": "Nvidia shares jump", "description": "Rally.", "url": "https://www.mx.com/m",
                       "published_at": "2026-10-16T13:00:00.000000Z", "source": "mx.com"}]}
AV_FEED = {"feed": [
    {"title": "Inflation cools in September", "url": "https://av.example.com/1",
     "time_published": "20261016T143000", "summary": "CPI eases.", "source": "Benzinga"},
    {"title": "Gaming console sales", "url": "https://av.example.com/2",
     "time_published": "20261016T143000", "summary": "Holiday season.", "source": "Benzinga"},
]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "finnhub_api_key", "fh-key")
    monkeypatch.setattr(settings, "marketaux_api_key", "mx-key")
    monkeypatch.setattr(settings, "alphavantage_api_key", "av-key")


@pytest.mark.asyncio
@respx.mock
async def test_finnhub_filters_market_news_and_adds_company_news(keys):
    market = respx.get(finnhub_source.FINNHUB_MARKET_NEWS).mock(return_value=httpx.Response(200, json=FINNHUB_MARKET))
    company = respx.get(finnhub_source.FINNHUB_COMPANY_NEWS).mock(return_value=httpx.Response(200, json=FINNHUB_COMPANY))
    async with httpx.AsyncClient() as client:
        articles = await finnhub_source.fetch(FIN, client)
    titles = [a.title for a in articles]
    assert "Nvidia earnings beat estimates" in titles
    assert "Oil prices slip" not in titles  # market news is keyword-filtered by the plan
    assert "NVDA guidance raised" in titles  # company news is not filtered
    assert all(a.raw_source_type == "finnhub" for a in articles)
    assert market.calls[0].request.headers["X-Finnhub-Token"] == "fh-key"
    assert company.calls[0].request.url.params["symbol"] == "NVDA"


@pytest.mark.asyncio
@respx.mock
async def test_marketaux_uses_symbols_when_tickers(keys):
    route = respx.get(marketaux_source.MARKETAUX_NEWS).mock(return_value=httpx.Response(200, json=MARKETAUX))
    async with httpx.AsyncClient() as client:
        articles = await marketaux_source.fetch(FIN, client)
    assert articles[0].raw_source_type == "marketaux" and articles[0].source == "mx.com"
    params = route.calls[0].request.url.params
    assert params["symbols"] == "NVDA" and "search" not in params and params["countries"] == "us"


@pytest.mark.asyncio
@respx.mock
async def test_alphavantage_topics_mode_filters_by_plan(keys):
    route = respx.get(alphavantage_source.ALPHAVANTAGE_QUERY).mock(return_value=httpx.Response(200, json=AV_FEED))
    async with httpx.AsyncClient() as client:
        articles = await alphavantage_source.fetch(TOPIC_ONLY, client)
    assert [a.title for a in articles] == ["Inflation cools in September"]
    assert articles[0].published_at.isoformat() == "2026-10-16T14:30:00+00:00"
    params = route.calls[0].request.url.params
    assert params["function"] == "NEWS_SENTIMENT" and "financial_markets" in params["topics"]


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("body", [{"Information": "API rate limit reached"}, {"Note": "Thank you for using"}])
async def test_alphavantage_limit_messages_are_empty(keys, body):
    respx.get(alphavantage_source.ALPHAVANTAGE_QUERY).mock(return_value=httpx.Response(200, json=body))
    async with httpx.AsyncClient() as client:
        assert await alphavantage_source.fetch(FIN, client) == []


@pytest.mark.asyncio
@respx.mock
async def test_finance_sources_not_called_for_general_topics(keys):
    routes = [respx.get(url).mock(return_value=httpx.Response(200, json={}))
              for url in (finnhub_source.FINNHUB_MARKET_NEWS, marketaux_source.MARKETAUX_NEWS,
                          alphavantage_source.ALPHAVANTAGE_QUERY)]
    finance_sources = [s for s in SOURCES if s.finance_only]
    result = await ingest(rule_plan("data centers and privacy in the US"), finance_sources)
    assert result.stats == {}
    assert all(route.call_count == 0 for route in routes)


def test_registered_as_finance_only():
    finance = {s.name for s in SOURCES if s.finance_only}
    assert finance == {"finnhub", "marketaux", "alphavantage"}
