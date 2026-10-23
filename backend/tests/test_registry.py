import asyncio

import pytest

from backend.config import settings
from backend.ingestion.registry import Source, ingest
from backend.search_plan import SearchPlan, rule_plan


def _source(name, articles=None, *, delay=0.0, raises=None, enabled=True, finance_only=False):
    async def fetch(plan, client):
        if delay:
            await asyncio.sleep(delay)
        if raises:
            raise raises
        return list(articles or [])
    return Source(name=name, fetch=fetch, enabled=lambda: enabled, finance_only=finance_only)


@pytest.mark.asyncio
async def test_ingest_merges_in_source_order_and_records_stats(make_article):
    a, b = make_article(title="A"), make_article(title="B")
    result = await ingest(rule_plan("climate"), [_source("rss", [a]), _source("gdelt", [b]), _source("brave", [])])
    assert result.articles == [a, b]
    assert result.stats["rss"].count == 1 and result.stats["rss"].status == "ok"
    assert result.stats["brave"].status == "empty"


@pytest.mark.asyncio
async def test_slow_and_raising_sources_do_not_block_others(make_article, monkeypatch):
    monkeypatch.setattr(settings, "source_timeout_seconds", 0.05)
    ok = make_article(title="fine")
    result = await ingest(rule_plan("climate"), [
        _source("rss", [ok]),
        _source("gdelt", [make_article()], delay=1.0),
        _source("brave", raises=RuntimeError("boom")),
    ])
    assert result.articles == [ok]
    assert result.stats["gdelt"].status == "timeout"
    assert result.stats["brave"].status == "error"


@pytest.mark.asyncio
async def test_overall_deadline_cancels_stragglers(make_article, monkeypatch):
    monkeypatch.setattr(settings, "source_timeout_seconds", 5.0)
    monkeypatch.setattr(settings, "ingest_deadline_seconds", 0.05)
    result = await ingest(rule_plan("climate"), [_source("gdelt", [make_article()], delay=1.0)])
    assert result.articles == []
    assert result.stats["gdelt"].status == "deadline"


@pytest.mark.asyncio
async def test_disabled_sources_are_reported_and_finance_sources_gated(make_article):
    general = rule_plan("data centers and privacy in the US")
    sources = [_source("guardian", enabled=False), _source("finnhub", [make_article()], finance_only=True)]
    result = await ingest(general, sources)
    assert result.skipped_missing_key == ["guardian"]
    assert "finnhub" not in result.stats

    finance = SearchPlan(phrase="nvda", queries=["nvda"], domains=["finance"])
    result = await ingest(finance, sources)
    assert result.stats["finnhub"].count == 1


@pytest.mark.asyncio
async def test_on_source_fires_per_active_source(make_article, monkeypatch):
    monkeypatch.setattr(settings, "source_timeout_seconds", 5.0)
    monkeypatch.setattr(settings, "ingest_deadline_seconds", 0.05)
    seen = {}

    async def on_source(name, stat, articles):
        seen[name] = (stat.status, len(articles))

    await ingest(rule_plan("climate"), [_source("rss", [make_article()]), _source("gdelt", [make_article()], delay=1.0)], on_source=on_source)
    assert seen == {"rss": ("ok", 1), "gdelt": ("deadline", 0)}


@pytest.mark.asyncio
async def test_on_source_failure_does_not_fail_ingest(make_article):
    a, b = make_article(title="A"), make_article(title="B")

    async def on_source(name, stat, articles):
        raise RuntimeError("callback bug")

    result = await ingest(rule_plan("climate"), [_source("rss", [a]), _source("gdelt", [b])], on_source=on_source)
    assert result.articles == [a, b]
