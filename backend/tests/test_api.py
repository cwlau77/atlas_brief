import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.config import settings
from backend.ingestion.registry import IngestResult
from backend.rate_limit import GlobalBudget, SlidingWindowLimiter


@pytest.fixture
def client(monkeypatch, make_article):
    async def fake_ingest(plan):
        return IngestResult(
            articles=[make_article(title=f"{plan.phrase} development one",
                                   snippet=f"Latest on {plan.phrase}.", url="https://ex.com/dev1")],
            stats={},
            skipped_missing_key=[],
        )

    monkeypatch.setattr(main, "ingest", fake_ingest)
    # Demo mode exercises the full pipeline without the Anthropic SDK.
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    monkeypatch.setattr(settings, "cache_ttl_minutes", 0)
    monkeypatch.setattr(main, "_budget", GlobalBudget(per_hour=0, per_day=0))
    main._briefing_cache.clear()
    return TestClient(main.app)


def test_briefing_contract(client):
    r = client.post("/briefing", json={"focus": "trade policy"})
    assert r.status_code == 200
    body = r.json()
    for key in ("focus", "generated_at", "key_developments", "emerging_tensions",
                "contradictions", "priority_alerts", "recommended_readings",
                "article_count", "source_breakdown"):
        assert key in body
    assert body["focus"] == "trade policy"


def test_focus_validation(client):
    assert client.post("/briefing", json={"focus": "x"}).status_code == 422
    assert client.post("/briefing", json={"focus": "y" * 500}).status_code == 422


def test_503_when_synthesis_unconfigured(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", False)
    r = client.post("/briefing", json={"focus": "trade policy"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]


def test_rate_limit_429(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    monkeypatch.setattr(main, "_limiter", SlidingWindowLimiter(2, 60.0))
    codes = [client.post("/briefing", json={"focus": "trade policy"}).status_code for _ in range(3)]
    assert codes[:2] == [200, 200]
    assert codes[2] == 429


def test_rate_limit_ignores_a_spoofed_forwarded_for(client, monkeypatch):
    # The left-most X-Forwarded-For entry is whatever the client sent; only the
    # right-most hop (appended by the platform's proxy) identifies the caller.
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    monkeypatch.setattr(main, "_limiter", SlidingWindowLimiter(2, 60.0))
    codes = [
        client.post("/briefing", json={"focus": f"spoof {i}"},
                    headers={"X-Forwarded-For": f"10.0.0.{i}, 203.0.113.7"}).status_code
        for i in range(3)
    ]
    assert codes == [200, 200, 429]


def test_global_budget_caps_new_briefings_but_not_cached_ones(client, monkeypatch):
    from backend.rate_limit import GlobalBudget
    monkeypatch.setattr(settings, "cache_ttl_minutes", 15)
    monkeypatch.setattr(main, "_budget", GlobalBudget(per_hour=1, per_day=10))
    assert client.post("/briefing", json={"focus": "first topic"}).status_code == 200
    blocked = client.post("/briefing", json={"focus": "second topic"})
    assert blocked.status_code == 429
    assert "briefing limit" in blocked.json()["detail"].lower()
    # Already-generated briefings are still served from the cache.
    assert client.post("/briefing", json={"focus": "first topic"}).status_code == 200


def test_api_docs_are_not_published_by_default(client):
    assert settings.expose_docs is False
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404
    assert "docs" not in client.get("/").json()


def test_cache_serves_second_request(client, monkeypatch):
    monkeypatch.setattr(settings, "cache_ttl_minutes", 15)
    calls = {"n": 0}
    real_ingest = main.ingest

    async def counting_ingest(plan):
        calls["n"] += 1
        return await real_ingest(plan)

    monkeypatch.setattr(main, "ingest", counting_ingest)
    assert client.post("/briefing", json={"focus": "cache probe"}).status_code == 200
    assert client.post("/briefing", json={"focus": "cache probe"}).status_code == 200
    assert calls["n"] == 1  # second response came from cache


def test_root_is_api_info_not_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "atlas-brief-api"


def test_502_names_sources_skipped_for_missing_keys(client, monkeypatch):
    async def empty_ingest(plan):
        return IngestResult(articles=[], stats={}, skipped_missing_key=["guardian", "tavily"])
    monkeypatch.setattr(main, "ingest", empty_ingest)
    r = client.post("/briefing", json={"focus": "trade policy"})
    assert r.status_code == 502
    assert "guardian" in r.json()["detail"] and "tavily" in r.json()["detail"]


def test_422_names_sources_skipped_for_missing_keys(client, monkeypatch, make_article):
    from backend.processing.rerank import RankResult

    async def thin_ingest(plan):
        return IngestResult(articles=[make_article(url="https://ex.com/off")], stats={},
                            skipped_missing_key=["guardian", "tavily"])

    async def rank_nothing(focus, plan, articles, embeddings):
        return RankResult(articles=[], candidates=1, reranked=False)

    monkeypatch.setattr(main, "ingest", thin_ingest)
    monkeypatch.setattr(main, "rank_articles", rank_nothing)
    r = client.post("/briefing", json={"focus": "trade policy"})
    assert r.status_code == 422
    assert "guardian" in r.json()["detail"] and "tavily" in r.json()["detail"]
    assert "NEWSAPI_KEY" not in r.json()["detail"]


def test_pipeline_log_times_each_step(client, caplog):
    import logging
    with caplog.at_level(logging.INFO, logger="briefing"):
        assert client.post("/briefing", json={"focus": "timing probe"}).status_code == 200
    line = next(r.getMessage() for r in caplog.records if "briefing pipeline" in r.getMessage())
    for step in ("plan_ms=", "ingest_ms=", "rank_ms=", "synthesis_ms=", "elapsed_ms="):
        assert step in line


def test_search_timeouts_are_tight():
    from backend.config import Settings
    assert Settings.model_fields["source_timeout_seconds"].default == 6.0
    assert Settings.model_fields["ingest_deadline_seconds"].default == 7.0
