import asyncio
import logging

import pytest

from backend import llm
from backend.config import settings
from backend.models import Contradiction, KeyDevelopment, OutlookItem, Tension
from backend.synthesis import links
from backend.synthesis.links import LINK_SYSTEM_PROMPT, link_outlook, link_signals, parse_links


def test_parse_links_clamps_and_dedupes():
    data = {"tensions": [[0, 5, 0, -1, True, "1", 1]], "contradictions": [[2]]}
    assert parse_links(data, n_devs=3, n_tensions=1, n_contradictions=1) == ([[0, 1]], [[2]])


def test_parse_links_wrong_length_or_shape_leaves_none():
    data = {"tensions": [[0]], "contradictions": "x"}
    assert parse_links(data, 3, 2, 1) == ([None, None], [None])


def test_parse_links_inner_non_list_is_none_and_empty_is_kept():
    assert parse_links({"tensions": [[], "0"], "contradictions": []}, 3, 2, 0) == ([[], None], [])


def test_parse_links_missing_key_is_all_none():
    assert parse_links({}, 3, 1, 2) == ([None], [None, None])


def _devs():
    return [
        KeyDevelopment(headline="H0", summary="S0", regions=["US"], sources=[]),
        KeyDevelopment(headline="H1", summary="S1", regions=["China"], sources=[]),
    ]


def _tensions():
    return [Tension(description="Tariff escalation", actors=["US", "China"], sources=[])]


def _contradictions():
    return [Contradiction(topic="Who fired first", account_a="a", account_b="b", sources_a=[], sources_b=[])]


def _keyed(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")


@pytest.mark.asyncio
async def test_link_signals_sends_both_sides_and_uses_context_model(monkeypatch):
    _keyed(monkeypatch)
    seen = {}

    async def fake(**kwargs):
        seen.update(kwargs)
        return '{"tensions": [[1]], "contradictions": [[]]}'

    monkeypatch.setattr(llm, "complete", fake)
    result = await link_signals(_devs(), _tensions(), _contradictions())
    assert seen["model"] == settings.context_model
    assert seen["system"] == LINK_SYSTEM_PROMPT
    prompt = seen["messages"][0]["content"]
    for text in ("H0", "H1", "Tariff escalation", "Who fired first"):
        assert text in prompt
    assert result == ([[1]], [[]])


@pytest.mark.asyncio
async def test_link_signals_skipped_without_signals(monkeypatch):
    _keyed(monkeypatch)

    async def fake(**kwargs):
        pytest.fail("llm.complete must not be called")

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_signals(_devs(), [], []) == ([], [])


@pytest.mark.asyncio
async def test_link_signals_skipped_without_key(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)

    async def fake(**kwargs):
        pytest.fail("llm.complete must not be called")

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_signals(_devs(), _tensions(), []) == ([None], [])


@pytest.mark.asyncio
async def test_link_signals_timeout_returns_none(monkeypatch, caplog):
    _keyed(monkeypatch)
    monkeypatch.setattr(links, "LINK_BUDGET_S", 0.05)

    async def fake(**kwargs):
        await asyncio.sleep(1)

    monkeypatch.setattr(llm, "complete", fake)
    with caplog.at_level(logging.WARNING, logger="briefing.synthesis"):
        result = await link_signals(_devs(), _tensions(), _contradictions())
    assert result == ([None], [None])
    assert any(r.name == "briefing.synthesis" and r.levelno == logging.WARNING for r in caplog.records)


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["not json", RuntimeError("upstream 529")])
async def test_link_signals_bad_json_or_error_returns_none(monkeypatch, reply):
    _keyed(monkeypatch)

    async def fake(**kwargs):
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_signals(_devs(), _tensions(), _contradictions()) == ([None], [None])


# --- Trends & implications ---

def _trends():
    return [OutlookItem(statement="Strikes are moving north", basis="assessment", sources=[])]


def _implications():
    return [OutlookItem(statement="Premiums stay high", basis="assessment", sources=[])]


@pytest.mark.asyncio
async def test_link_outlook_sends_both_lists_and_uses_context_model(monkeypatch):
    _keyed(monkeypatch)
    seen = {}

    async def fake(**kwargs):
        seen.update(kwargs)
        return '{"trends": [[0, 1]], "implications": [[]]}'

    monkeypatch.setattr(llm, "complete", fake)
    result = await link_outlook(_devs(), _trends(), _implications())
    assert seen["model"] == settings.context_model
    prompt = seen["messages"][0]["content"]
    for text in ("TRENDS:", "IMPLICATIONS:", "Strikes are moving north", "Premiums stay high", "H1"):
        assert text in prompt
    assert '"trends"' not in prompt  # test_synthesis routes fake replies by that key
    assert result == ([[0, 1]], [[]])


@pytest.mark.asyncio
async def test_link_outlook_skipped_without_items(monkeypatch):
    _keyed(monkeypatch)

    async def fake(**kwargs):
        pytest.fail("llm.complete must not be called")

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_outlook(_devs(), [], []) == ([], [])


@pytest.mark.asyncio
async def test_link_outlook_timeout_returns_none(monkeypatch):
    _keyed(monkeypatch)
    monkeypatch.setattr(links, "LINK_BUDGET_S", 0.05)

    async def fake(**kwargs):
        await asyncio.sleep(1)

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_outlook(_devs(), _trends(), _implications()) == ([None], [None])


@pytest.mark.asyncio
async def test_link_outlook_bad_json_returns_none(monkeypatch):
    _keyed(monkeypatch)

    async def fake(**kwargs):
        return "not json"

    monkeypatch.setattr(llm, "complete", fake)
    assert await link_outlook(_devs(), _trends(), _implications()) == ([None], [None])
