import json

import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.config import settings
from backend.ingestion.registry import IngestResult, SourceStat
from backend.rate_limit import GlobalBudget, SlidingWindowLimiter


@pytest.fixture
def client(monkeypatch, make_article):
    async def fake_ingest(plan, on_source=None):
        article = make_article(title=f"{plan.phrase} development one", source="BBC",
                               snippet=f"Latest on {plan.phrase}.", url="https://ex.com/dev1")
        if on_source:
            await on_source("rss", SourceStat(1, "ok", 5), [article])
        return IngestResult(articles=[article], stats={}, skipped_missing_key=[])

    monkeypatch.setattr(main, "ingest", fake_ingest)
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    monkeypatch.setattr(settings, "cache_ttl_minutes", 0)
    monkeypatch.setattr(main, "_budget", GlobalBudget(per_hour=0, per_day=0))
    main._briefing_cache.clear()
    return TestClient(main.app)


def _events(res):
    return [json.loads(line) for line in res.text.splitlines() if line.strip()]


def test_stream_success_order(client):
    res = client.post("/briefing/stream", json={"focus": "trade policy"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/x-ndjson")
    events = _events(res)
    types = [e["type"] for e in events]
    assert types[:3] == ["plan", "source", "ranked"]
    assert types[-1] == "briefing"
    assert events[1] == {"type": "source", "name": "rss", "count": 1, "status": "ok", "outlets": {"BBC": 1}}
    assert {"place", "queries", "is_finance", "sources"} <= set(events[0])
    plain = client.post("/briefing", json={"focus": "trade policy"}).json()
    assert set(events[-1]["briefing"]) == set(plain)


def test_stream_cache_hit_emits_only_briefing(client, monkeypatch):
    monkeypatch.setattr(settings, "cache_ttl_minutes", 15)
    client.post("/briefing/stream", json={"focus": "trade policy"})
    events = _events(client.post("/briefing/stream", json={"focus": "trade policy"}))
    assert [e["type"] for e in events] == ["briefing"]


def test_stream_rate_limit_is_plain_http(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 1)
    monkeypatch.setattr(main, "_limiter", SlidingWindowLimiter(1, 60.0))
    client.post("/briefing/stream", json={"focus": "trade policy"})
    res = client.post("/briefing/stream", json={"focus": "trade policy"})
    assert res.status_code == 429
    assert res.json()["detail"] == "Too many briefing requests from this address. Please wait a minute and try again."


def test_stream_no_articles_is_error_event(client, monkeypatch):
    async def empty_ingest(plan, on_source=None):
        return IngestResult(articles=[], stats={}, skipped_missing_key=[])

    monkeypatch.setattr(main, "ingest", empty_ingest)
    plain = client.post("/briefing", json={"focus": "trade policy"})
    events = _events(client.post("/briefing/stream", json={"focus": "trade policy"}))
    assert plain.status_code == 502
    assert events[-1] == {"type": "error", "status": 502, "detail": plain.json()["detail"]}


def test_stream_422_is_error_event(client, monkeypatch):
    from backend.processing.rerank import RankResult

    async def rank_nothing(focus, plan, articles, embeddings):
        return RankResult(articles=[], candidates=1, reranked=False)

    monkeypatch.setattr(main, "rank_articles", rank_nothing)
    plain = client.post("/briefing", json={"focus": "trade policy"})
    events = _events(client.post("/briefing/stream", json={"focus": "trade policy"}))
    assert plain.status_code == 422
    assert events[-1] == {"type": "error", "status": 422, "detail": plain.json()["detail"]}


def test_stream_503_is_error_event(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", False)
    events = _events(client.post("/briefing/stream", json={"focus": "trade policy"}))
    assert events[-1]["type"] == "error" and events[-1]["status"] == 503
    assert "ANTHROPIC_API_KEY" in events[-1]["detail"]
