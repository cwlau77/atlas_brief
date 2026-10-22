from datetime import datetime

import pytest

from backend.config import settings
from backend.synthesis.briefing import (
    SynthesisFailedError,
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


def test_system_prompt_keeps_substance_and_adds_injection_guard():
    from backend.synthesis.briefing import SYSTEM_PROMPT
    # The analytic standards are the product — guard against accidental gutting.
    for anchor in ("CONTRADICTIONS", "EMERGING TENSIONS", "escalation potential",
                   "grounded in the supplied articles"):
        assert anchor in SYSTEM_PROMPT
    assert "untrusted" in SYSTEM_PROMPT.lower()


def test_user_prompt_delimits_article_data(make_article):
    from backend.synthesis.briefing import _build_user_prompt
    p = _build_user_prompt("trade", [make_article()])
    assert "=== BEGIN ARTICLE DATA (untrusted content) ===" in p
    assert "=== END ARTICLE DATA ===" in p


def test_fallback_briefing_survives_mixed_tz(make_article):
    naive = make_article(title="War risk grows on border", published_at=datetime(2026, 7, 5, 8, 0))
    aware = make_article(title="Attack reported near port city")
    b = _fallback_briefing("security", [naive, aware])  # must not raise TypeError
    assert b.article_count == 2


@pytest.mark.asyncio
async def test_synthesis_uses_configured_max_tokens(monkeypatch, make_article):
    # 25 articles with long Google News URLs overflowed the old hard-coded 4000-token cap.
    import json
    from types import SimpleNamespace
    import backend.llm as llm

    calls = []

    class FakeMessages:
        async def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(DATA))])

    class FakeClient:
        def __init__(self, **_):
            self.messages = FakeMessages()

    monkeypatch.setattr(llm, "AsyncAnthropic", FakeClient)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "synthesis_max_tokens", 12000)
    await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert calls[0]["max_tokens"] == 12000


def test_citations_by_article_number_resolve_server_side(make_article):
    # The model cites [n] article numbers; outlet/url/date come from our own data,
    # so long Google News URLs never pass through the model's output.
    a1 = make_article(title="Moratorium bills filed", url="https://news.google.com/rss/articles/LONG1", source="WTOP")
    a2 = make_article(title="Roanoke site confirmed", url="https://ex.com/2", source="Cardinal News")
    data = {
        "key_developments": [{"headline": "H", "summary": "S", "regions": ["Virginia"], "sources": [2, 1, 2, 99, 0, True, "x"]}],
        "emerging_tensions": [{"description": "D", "actors": ["A"], "sources": [1]}],
        "contradictions": [{"topic": "T", "account_a": "A", "account_b": "B", "sources_a": [1], "sources_b": [2]}],
        "priority_alerts": [{"severity": "high", "headline": "H", "rationale": "R", "sources": [2]}],
        "recommended_readings": [{"article": 2, "why": "primary"}, {"article": 7, "why": "out of range"}],
    }
    b = briefing_from_data(data, "data centers", [a1, a2])
    dev = b.key_developments[0]
    # valid numbers resolve in order, duplicates/out-of-range/non-int entries dropped
    assert [(s.outlet, s.url) for s in dev.sources] == [("Cardinal News", "https://ex.com/2"), ("WTOP", a1.url)]
    assert dev.sources[0].published_at == a2.published_at
    assert b.emerging_tensions[0].sources[0].url == a1.url
    assert b.contradictions[0].sources_b[0].url == "https://ex.com/2"
    assert b.priority_alerts[0].sources[0].outlet == "Cardinal News"
    assert [(r.title, r.outlet, r.url, r.why) for r in b.recommended_readings] == [
        ("Roanoke site confirmed", "Cardinal News", "https://ex.com/2", "primary")]


def test_schema_asks_for_article_numbers_not_urls(make_article):
    from backend.synthesis.briefing import SECTION_SCHEMAS, _build_user_prompt
    for schema in SECTION_SCHEMAS.values():
        assert '"url"' not in schema
        assert "article number" in schema.lower()
    p = _build_user_prompt("trade", [make_article(url="https://news.google.com/rss/articles/LONG")])
    assert "news.google.com" not in p


def test_citations_carry_the_article_image(make_article):
    a1 = make_article(title="One", url="https://ex.com/1")
    a2 = make_article(title="Two", url="https://ex.com/2", image_url="https://i.ex/2.jpg")
    data = {"key_developments": [{"headline": "H", "summary": "S", "regions": ["Egypt"], "sources": [2, 1]}]}
    a2 = a2.model_copy(update={"image_outlet": "AP"})
    dev = briefing_from_data(data, "focus", [a1, a2]).key_developments[0]
    assert dev.sources[0].image_url == "https://i.ex/2.jpg"
    assert dev.sources[0].image_outlet == "AP"
    assert dev.sources[1].image_url is None
    fallback = _fallback_briefing("focus", [a2])
    assert fallback.key_developments[0].sources[0].image_url == "https://i.ex/2.jpg"


def test_schema_asks_for_a_city_or_null():
    from backend.synthesis.briefing import SECTION_SCHEMAS
    assert '"city"' in SECTION_SCHEMAS["developments"]
    assert "Name a city only if the cited articles place the events there; otherwise null" in SECTION_SCHEMAS["developments"]


def _dev_with_city(city, regions, make_article):
    data = {"key_developments": [{"headline": "H", "summary": "S", "regions": regions, "city": city, "sources": [1]}]}
    return briefing_from_data(data, "focus", [make_article()]).key_developments[0]


def test_resolved_city_becomes_place(make_article):
    dev = _dev_with_city("Aden, Yemen", ["Yemen"], make_article)
    assert dev.place.name == "Aden" and dev.place.country == "Yemen"


@pytest.mark.parametrize("city,regions", [("Aden, Yemen", ["Egypt"]), (7, ["Yemen"]), (None, ["Yemen"])])
def test_unresolvable_or_mismatched_city_is_dropped(city, regions, make_article):
    assert _dev_with_city(city, regions, make_article).place is None


def test_fallback_briefing_has_no_place(make_article):
    b = _fallback_briefing("Aden port", [make_article(title="Strike near Aden port in Yemen")])
    assert all(dev.place is None for dev in b.key_developments)


# --- Split synthesis: three section calls in parallel, context overlapping the slower ones ---

SECTION_REPLIES = {
    "key_developments": {"key_developments": [{"headline": "H", "summary": "S", "regions": ["Egypt"], "sources": [1]}]},
    "emerging_tensions": {"emerging_tensions": [{"description": "D", "actors": ["A", "B"], "sources": [1]}],
                          "contradictions": [{"topic": "T", "account_a": "a", "account_b": "b", "sources_a": [1], "sources_b": [1]}]},
    "priority_alerts": {"priority_alerts": [{"severity": "high", "headline": "AH", "rationale": "R", "sources": [1]}],
                        "recommended_readings": [{"article": 1, "why": "primary"}]},
}


def _section_of(prompt: str) -> str:
    for key in SECTION_REPLIES:
        if f'"{key}"' in prompt:
            return key
    return "context"


def _keyed(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "demo_mode", False)


@pytest.mark.asyncio
async def test_sections_are_written_by_separate_calls_and_merged(monkeypatch, make_article):
    import json
    import backend.llm as llm
    _keyed(monkeypatch)
    seen = []

    async def complete(**kwargs):
        prompt = kwargs["messages"][0]["content"]
        section = _section_of(prompt)
        seen.append(section)
        if section == "context":
            return "Background paragraph."
        # Each call asks for its own section only.
        others = [k for k in SECTION_REPLIES if k != section]
        assert all(f'"{k}"' not in prompt for k in others)
        return json.dumps(SECTION_REPLIES[section])

    monkeypatch.setattr(llm, "complete", complete)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert sorted(set(seen)) == ["context", "emerging_tensions", "key_developments", "priority_alerts"]
    assert b.key_developments[0].headline == "H"
    assert b.key_developments[0].historical_context == "Background paragraph."
    assert b.emerging_tensions[0].description == "D"
    assert b.contradictions[0].topic == "T"
    assert b.priority_alerts[0].headline == "AH"
    assert b.recommended_readings[0].why == "primary"


@pytest.mark.asyncio
async def test_context_runs_while_the_other_sections_are_still_being_written(monkeypatch, make_article):
    import asyncio
    import json
    import backend.llm as llm
    _keyed(monkeypatch)
    context_started = asyncio.Event()

    async def complete(**kwargs):
        section = _section_of(kwargs["messages"][0]["content"])
        if section == "context":
            context_started.set()
            return "Background."
        if section != "key_developments":
            # The slower sections only finish once context has begun: a sequential pipeline would hang here.
            await asyncio.wait_for(context_started.wait(), timeout=2)
        return json.dumps(SECTION_REPLIES[section])

    monkeypatch.setattr(llm, "complete", complete)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.key_developments[0].historical_context == "Background."


@pytest.mark.asyncio
async def test_a_failed_secondary_section_is_left_empty(monkeypatch, make_article):
    import json
    import backend.llm as llm
    _keyed(monkeypatch)

    async def complete(**kwargs):
        section = _section_of(kwargs["messages"][0]["content"])
        if section == "context":
            return ""
        if section == "emerging_tensions":
            return "not json"
        if section == "priority_alerts":
            raise RuntimeError("upstream 529")
        return json.dumps(SECTION_REPLIES[section])

    monkeypatch.setattr(llm, "complete", complete)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.key_developments[0].headline == "H"
    assert b.emerging_tensions == [] and b.contradictions == []
    assert b.priority_alerts == [] and b.recommended_readings == []


@pytest.mark.asyncio
async def test_failed_developments_still_fail_the_briefing(monkeypatch, make_article):
    import json
    import backend.llm as llm
    _keyed(monkeypatch)

    async def complete(**kwargs):
        section = _section_of(kwargs["messages"][0]["content"])
        return "not json" if section == "key_developments" else json.dumps(SECTION_REPLIES.get(section, {}))

    monkeypatch.setattr(llm, "complete", complete)
    with pytest.raises(SynthesisFailedError):
        await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])


# --- Commons file photos ---

def _fast_llm(monkeypatch):
    import json
    import backend.llm as llm

    async def complete(**kwargs):
        section = _section_of(kwargs["messages"][0]["content"])
        if section == "context":
            return "Background."
        return json.dumps(SECTION_REPLIES[section])

    monkeypatch.setattr(llm, "complete", complete)


@pytest.mark.asyncio
async def test_commons_runs_alongside_context(monkeypatch, make_article):
    import asyncio
    import time
    import backend.synthesis.briefing as mod
    _keyed(monkeypatch)
    _fast_llm(monkeypatch)
    monkeypatch.setattr(settings, "commons_images_enabled", True)

    async def slow_enrich(partial):
        await asyncio.sleep(0.3)

    async def slow_fetch(queries, client, budget_s=1.5):
        await asyncio.sleep(0.3)
        return {}

    monkeypatch.setattr(mod, "enrich_with_historical_context", slow_enrich)
    monkeypatch.setattr(mod, "fetch_candidates", slow_fetch)
    start = time.monotonic()
    await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert time.monotonic() - start < 0.5


@pytest.mark.asyncio
async def test_commons_disabled_flag(monkeypatch, make_article):
    import backend.synthesis.briefing as mod
    _keyed(monkeypatch)
    _fast_llm(monkeypatch)
    monkeypatch.setattr(settings, "commons_images_enabled", False)
    called = []

    async def fetch(*a, **k):
        called.append(1)
        return {}

    monkeypatch.setattr(mod, "fetch_candidates", fetch)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert called == []
    assert b.key_developments[0].commons_image is None


@pytest.mark.asyncio
async def test_commons_failure_does_not_fail_briefing(monkeypatch, make_article):
    import backend.synthesis.briefing as mod
    _keyed(monkeypatch)
    _fast_llm(monkeypatch)
    monkeypatch.setattr(settings, "commons_images_enabled", True)

    async def boom(*a, **k):
        raise RuntimeError("commons down")

    monkeypatch.setattr(mod, "fetch_candidates", boom)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.key_developments[0].headline == "H"
    assert all(d.commons_image is None for d in b.key_developments)
    assert all(a.commons_image is None for a in b.priority_alerts)


# --- Tension linking ---

def _linking_llm(monkeypatch, link_reply=None, link_error=None, context=None):
    import json
    import backend.llm as llm
    from backend.synthesis.links import LINK_SYSTEM_PROMPT

    async def complete(**kwargs):
        if kwargs["system"] == LINK_SYSTEM_PROMPT:
            if link_error:
                raise link_error
            return link_reply
        section = _section_of(kwargs["messages"][0]["content"])
        if section == "context":
            return await context() if context else "Background."
        return json.dumps(SECTION_REPLIES[section])

    monkeypatch.setattr(llm, "complete", complete)


@pytest.mark.asyncio
async def test_tension_links_reach_the_briefing(monkeypatch, make_article):
    _keyed(monkeypatch)
    _linking_llm(monkeypatch, link_reply='{"tensions": [[0]], "contradictions": [[]]}')
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.emerging_tensions[0].related_developments == [0]
    assert b.contradictions[0].related_developments == []


@pytest.mark.asyncio
async def test_linking_starts_before_context_finishes(monkeypatch, make_article):
    import asyncio
    _keyed(monkeypatch)
    link_started = asyncio.Event()

    async def context():
        # Context only finishes once the link call has begun: a sequential pipeline would hang here.
        await asyncio.wait_for(link_started.wait(), timeout=2)
        return "Background."

    import backend.llm as llm
    from backend.synthesis.links import LINK_SYSTEM_PROMPT
    _linking_llm(monkeypatch, link_reply='{"tensions": [[0]], "contradictions": [[0]]}', context=context)
    inner = llm.complete

    async def complete(**kwargs):
        if kwargs["system"] == LINK_SYSTEM_PROMPT:
            link_started.set()
        return await inner(**kwargs)

    monkeypatch.setattr(llm, "complete", complete)
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.key_developments[0].historical_context == "Background."
    assert b.emerging_tensions[0].related_developments == [0]


@pytest.mark.asyncio
async def test_link_failure_leaves_none_and_briefing_returns(monkeypatch, make_article):
    _keyed(monkeypatch)
    _linking_llm(monkeypatch, link_error=RuntimeError("upstream 529"))
    b = await synthesize_briefing("trade", [make_article(url="https://ex.com/1")])
    assert b.emerging_tensions and b.contradictions
    assert all(t.related_developments is None for t in b.emerging_tensions)
    assert all(c.related_developments is None for c in b.contradictions)


@pytest.mark.asyncio
async def test_fallback_briefing_has_no_links(monkeypatch, make_article):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    monkeypatch.setattr(settings, "demo_mode", True)
    b = await synthesize_briefing("trade", [make_article(title="Sanction dispute widens")])
    assert b.emerging_tensions
    assert all(t.related_developments is None for t in b.emerging_tensions)
