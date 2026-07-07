from datetime import datetime

import pytest

from backend.config import settings
from backend.synthesis.briefing import (
    SynthesisUnavailableError,
    _fallback_briefing,
    briefing_from_data,
    enforce_url_allowlist,
    extract_json,
    synthesize_briefing,
)

RAW_FENCED = '```json\n{"key_developments": []}\n```'
DATA = {
    "key_developments": [{
        "headline": "Talks stall", "summary": "Deadlock continues.",
        "regions": ["Egypt"],
        "sources": [{"outlet": "ExWire", "url": "https://ex.com/1", "published_at": None},
                    {"outlet": "Fabricated", "url": "https://evil.example/x", "published_at": None}],
    }],
    "emerging_tensions": [], "contradictions": [], "priority_alerts": [],
    "recommended_readings": [
        {"title": "Real", "outlet": "ExWire", "url": "https://ex.com/1", "why": "primary"},
        {"title": "Fake", "outlet": "Nope", "url": "https://evil.example/x", "why": "hallucinated"},
    ],
}


def test_extract_json_tolerates_fences_and_rejects_garbage():
    assert extract_json(RAW_FENCED) == {"key_developments": []}
    assert extract_json('Here you go: {"a": 1} hope that helps') == {"a": 1}
    with pytest.raises(ValueError):
        extract_json("I could not produce JSON, sorry.")
    with pytest.raises(ValueError):
        extract_json('{"unclosed": ')


def test_allowlist_strips_unknown_urls(make_article):
    art = make_article(title="Talks stall", url="https://ex.com/1")
    b = briefing_from_data(DATA, "ceasefire", [art])
    b = enforce_url_allowlist(b, {art.url})
    urls = [s.url for s in b.key_developments[0].sources]
    assert urls == ["https://ex.com/1"]
    assert [r.url for r in b.recommended_readings] == ["https://ex.com/1"]


@pytest.mark.asyncio
async def test_no_key_raises_unless_demo_mode(monkeypatch, make_article):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", False)
    with pytest.raises(SynthesisUnavailableError):
        await synthesize_briefing("trade", [make_article()])
    monkeypatch.setattr(settings, "demo_mode", True)
    b = await synthesize_briefing("trade", [make_article()])
    assert b.article_count == 1


def test_fallback_briefing_survives_mixed_tz(make_article):
    naive = make_article(title="War risk grows on border", published_at=datetime(2026, 7, 5, 8, 0))
    aware = make_article(title="Attack reported near port city")
    b = _fallback_briefing("security", [naive, aware])  # must not raise TypeError
    assert b.article_count == 2
