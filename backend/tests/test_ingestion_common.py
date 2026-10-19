from datetime import date, datetime, timezone

import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion.common import (
    clean_text, get_json, matches_plan, outlet_from_url, parse_datetime, post_json,
)
from backend.ingestion.query_format import and_query, best_query, or_of_ands, query_terms
from backend.ingestion.quota import QuotaGuard
from backend.search_plan import SearchPlan


@pytest.mark.parametrize("value,expected", [
    ("2026-10-16T14:30:00Z", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("2026-10-16T14:30:00+02:00", datetime(2026, 10, 16, 12, 30, tzinfo=timezone.utc)),
    ("2026-10-16 14:30:00", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("Fri, 16 Oct 2026 14:30:00 GMT", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("20261016T143000Z", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("20261016T143000", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    (1792161000, datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
])
def test_parse_datetime_formats_are_utc_aware(value, expected):
    parsed = parse_datetime(value)
    assert parsed == expected
    assert parsed.tzinfo is not None


@pytest.mark.parametrize("value", [None, "", "yesterday", {}, "2026-13-45"])
def test_parse_datetime_bad_input_is_none(value):
    assert parse_datetime(value) is None


def test_clean_text_strips_html_and_whitespace():
    assert clean_text("<p>Data  <b>centers</b></p>\n grow") == "Data centers grow"
    assert clean_text(None) == ""
    assert len(clean_text("x" * 5000)) == 1000


def test_outlet_from_url():
    assert outlet_from_url("https://www.reuters.com/tech/x") == "reuters.com"
    assert outlet_from_url("not a url") == ""


def test_matches_plan_uses_match_terms():
    plan = SearchPlan(phrase="data centers privacy", queries=["x"], must_terms=["data centers", "privacy"])
    assert matches_plan("New privacy rules for apps", plan)
    assert not matches_plan("US jobs data beat forecasts", plan)


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("response,expected", [
    (httpx.Response(200, json={"ok": 1}), {"ok": 1}),
    (httpx.Response(429), None),
    (httpx.Response(500), None),
    (httpx.Response(200, text="<html>not json"), None),
])
async def test_get_json_handles_errors(response, expected):
    respx.get("https://api.example.com/x").mock(return_value=response)
    async with httpx.AsyncClient() as client:
        assert await get_json(client, "https://api.example.com/x", source="test") == expected


@pytest.mark.asyncio
@respx.mock
async def test_get_and_post_json_network_error_is_none():
    respx.get("https://api.example.com/x").mock(side_effect=httpx.ConnectError("down"))
    respx.post("https://api.example.com/y").mock(side_effect=httpx.ReadTimeout("slow"))
    async with httpx.AsyncClient() as client:
        assert await get_json(client, "https://api.example.com/x", source="test") is None
        assert await post_json(client, "https://api.example.com/y", source="test", json_body={}) is None


def test_query_formatting():
    assert query_terms('"data centers" privacy') == ['"data centers"', "privacy"]
    assert and_query('"data centers" privacy') == '"data centers" AND privacy'
    assert or_of_ands(['"data centers" privacy', "hyperscale"]) == '("data centers" AND privacy) OR (hyperscale)'
    assert or_of_ands(["climate"]) == "climate"
    assert best_query(SearchPlan(phrase="p", queries=[])) == "p"
    assert best_query(SearchPlan(phrase="p", queries=["q1", "q2"])) == "q1"


def test_quota_guard_budget_and_daily_reset(monkeypatch):
    monkeypatch.setattr(settings, "quota_tavily_per_day", 2, raising=False)
    day = {"d": date(2026, 10, 17)}
    guard = QuotaGuard(today=lambda: day["d"])
    assert guard.take("tavily") and guard.take("tavily")
    assert guard.take("tavily") is False
    day["d"] = date(2026, 10, 18)
    assert guard.take("tavily") is True


def test_quota_guard_unlimited_source_and_multi_take(monkeypatch):
    monkeypatch.setattr(settings, "quota_guardian_per_day", 3, raising=False)
    guard = QuotaGuard(today=lambda: date(2026, 10, 17))
    assert all(guard.take("gdelt") for _ in range(100))
    assert guard.take("guardian", n=2) is True
    assert guard.take("guardian", n=2) is False


@pytest.mark.parametrize("value,expected", [
    ("https://i.ex/a.jpg", "https://i.ex/a.jpg"),
    ("  https://i.ex/a.jpg ", "https://i.ex/a.jpg"),
    ("http://i.ex/a.jpg", None),
    ("", None),
    (None, None),
    (42, None),
])
def test_make_article_keeps_only_https_images(value, expected):
    from backend.ingestion.common import make_article
    article = make_article("rss", title="T", url="https://ex.com/1", outlet="Ex", image_url=value)
    assert article.image_url == expected
    assert article.image_outlet == ("Ex" if expected else None)
