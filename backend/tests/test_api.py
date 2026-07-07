import pytest
from fastapi.testclient import TestClient

import backend.main as main
from backend.config import settings
from backend.rate_limit import SlidingWindowLimiter


@pytest.fixture
def client(monkeypatch, make_article):
    async def fake_ingest(focus):
        return [make_article(title=f"{focus} development one", snippet=f"Latest on {focus}.",
                             url="https://ex.com/dev1")]

    monkeypatch.setattr(main, "_ingest_all", fake_ingest)
    # Demo mode exercises the full pipeline without the Anthropic SDK.
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    monkeypatch.setattr(settings, "cache_ttl_minutes", 0)
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


def test_cache_serves_second_request(client, monkeypatch):
    monkeypatch.setattr(settings, "cache_ttl_minutes", 15)
    calls = {"n": 0}
    real_ingest = main._ingest_all

    async def counting_ingest(focus):
        calls["n"] += 1
        return await real_ingest(focus)

    monkeypatch.setattr(main, "_ingest_all", counting_ingest)
    assert client.post("/briefing", json={"focus": "cache probe"}).status_code == 200
    assert client.post("/briefing", json={"focus": "cache probe"}).status_code == 200
    assert calls["n"] == 1  # second response came from cache


def test_root_is_api_info_not_html(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["service"] == "atlas-brief-api"
