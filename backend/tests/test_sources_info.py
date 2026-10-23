from fastapi.testclient import TestClient

from backend import main
from backend.config import settings
from backend.ingestion.registry import SOURCES
from backend.ingestion.rss_source import RSS_FEEDS
from backend.sources_info import sources_payload


def _by_name(payload):
    return {s["name"]: s for s in payload["services"]}


def test_payload_lists_every_non_rss_source():
    payload = sources_payload()
    assert {s["name"] for s in payload["services"]} == {s.name for s in SOURCES} - {"rss"}
    assert len(payload["services"]) == 12


def test_enabled_follows_keys(monkeypatch):
    monkeypatch.setattr(settings, "brave_api_key", None)
    assert _by_name(sources_payload())["brave"]["enabled"] is False
    monkeypatch.setattr(settings, "brave_api_key", "x")
    by_name = _by_name(sources_payload())
    assert by_name["brave"]["enabled"] is True
    assert by_name["google_news"]["enabled"] is True
    assert by_name["gdelt"]["enabled"] is True


def test_finance_flags():
    flagged = {s["name"] for s in sources_payload()["services"] if s["finance_only"]}
    assert flagged == {"finnhub", "marketaux", "alphavantage"}


def test_feeds_count_and_collapsed_outlets():
    feeds = sources_payload()["feeds"]
    assert feeds["count"] == len(RSS_FEEDS) == 26
    outlets = feeds["outlets"]
    assert len(outlets) == 23
    assert outlets.count("New York Times") == 1
    assert outlets.count("NPR") == 1
    assert not any(o.startswith("New York Times ") for o in outlets)


def test_every_source_has_a_label():
    by_name = _by_name(sources_payload())
    assert all(s["label"] for s in by_name.values())
    assert by_name["gdelt"]["label"] == "GDELT 2.0"
    assert by_name["google_news"]["label"] == "Google News"


def test_sources_endpoint():
    res = TestClient(main.app).get("/sources")
    assert res.status_code == 200
    body = res.json()
    assert "services" in body and "feeds" in body
