import httpx
import pytest
import respx
from fastapi.testclient import TestClient

import backend.main as main
from backend.config import settings
from backend.ingestion.registry import IngestResult
from backend.rate_limit import GlobalBudget
from backend.turnstile import SITEVERIFY_URL


@pytest.fixture
def client(monkeypatch, make_article):
    async def fake_ingest(plan):
        return IngestResult(articles=[make_article(title=f"{plan.phrase} news", url="https://ex.com/1")],
                            stats={}, skipped_missing_key=[])
    monkeypatch.setattr(main, "ingest", fake_ingest)
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(settings, "rate_limit_per_minute", 0)
    monkeypatch.setattr(settings, "cache_ttl_minutes", 0)
    monkeypatch.setattr(settings, "turnstile_secret_key", "secret")
    monkeypatch.setattr(main, "_budget", GlobalBudget(per_hour=0, per_day=0))
    return TestClient(main.app)


def post(client, token=None):
    headers = {"X-Turnstile-Token": token} if token is not None else {}
    return client.post("/briefing", json={"focus": "trade policy"}, headers=headers)


def test_missing_token_is_refused_before_any_work(client, monkeypatch):
    calls = []
    async def counting_ingest(plan):
        calls.append(plan)
    monkeypatch.setattr(main, "ingest", counting_ingest)
    r = post(client)
    assert r.status_code == 403
    assert "verify" in r.json()["detail"].lower()
    assert calls == []


@respx.mock
def test_rejected_token_is_refused(client):
    route = respx.post(SITEVERIFY_URL).mock(return_value=httpx.Response(200, json={"success": False}))
    assert post(client, "bad").status_code == 403
    sent = route.calls[0].request.content.decode()
    assert "secret=secret" in sent and "response=bad" in sent


@respx.mock
def test_verified_token_gets_a_briefing(client):
    respx.post(SITEVERIFY_URL).mock(return_value=httpx.Response(200, json={"success": True}))
    assert post(client, "good").status_code == 200


@respx.mock
def test_cloudflare_outage_fails_open(client):
    # The global budget still bounds spend; an outage at Cloudflare shouldn't take Atlas down.
    respx.post(SITEVERIFY_URL).mock(side_effect=httpx.ConnectError("down"))
    assert post(client, "any").status_code == 200
    respx.post(SITEVERIFY_URL).mock(return_value=httpx.Response(500))
    assert post(client, "any").status_code == 200


def test_no_secret_means_no_check(client, monkeypatch):
    monkeypatch.setattr(settings, "turnstile_secret_key", None)
    assert post(client).status_code == 200


def test_budget_defaults():
    from backend.config import Settings
    defaults = Settings.model_fields
    assert defaults["briefing_budget_per_hour"].default == 20
    assert defaults["briefing_budget_per_day"].default == 100
