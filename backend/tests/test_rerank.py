import json
from types import SimpleNamespace

import pytest

import backend.llm as llm_module
from backend.config import settings
from backend.processing.embeddings import embed_texts
from backend.processing.rerank import _parse_scores, prefilter, rank_articles, rerank
from backend.search_plan import SearchPlan, rule_plan
from backend.tests.fixtures.broad_topics import BROAD_TOPICS


class _FakeAnthropic:
    reply: str | Exception = ""
    calls: list[dict] = []

    def __init__(self, **kwargs):
        self.messages = self

    async def create(self, **kwargs):
        _FakeAnthropic.calls.append(kwargs)
        if isinstance(_FakeAnthropic.reply, Exception):
            raise _FakeAnthropic.reply
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=_FakeAnthropic.reply)])


@pytest.fixture
def fake_llm(monkeypatch):
    _FakeAnthropic.calls = []
    monkeypatch.setattr(llm_module, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "rerank_enabled", True)
    return _FakeAnthropic


async def _embed(articles):
    return await embed_texts([f"{a.title}. {a.snippet}" for a in articles])


@pytest.mark.asyncio
async def test_broad_topic_prefilter_keeps_relevant_and_rejects_noise(make_article):
    focuses = sorted({row[0] for row in BROAD_TOPICS})
    for focus in focuses:
        rows = [r for r in BROAD_TOPICS if r[0] == focus]
        articles = [make_article(title=t, snippet=s) for _, t, s, _ in rows]
        kept, _ = await prefilter(rule_plan(focus), articles, await _embed(articles))
        relevant = [a for a, row in zip(articles, rows) if row[3]]
        noise = [a for a, row in zip(articles, rows) if not row[3]]
        recall = sum(a in kept for a in relevant) / len(relevant)
        assert recall >= 0.9, f"{focus}: recall {recall:.2f}"
        assert not any(a in kept for a in noise), f"{focus}: noise leaked {[a.title for a in noise if a in kept]}"


@pytest.mark.asyncio
async def test_prefilter_caps_candidates_and_tolerates_missing_dates(make_article, monkeypatch):
    monkeypatch.setattr(settings, "rerank_max_candidates", 3)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    articles = [make_article(title=f"Privacy story {i}", snippet="privacy") for i in range(6)]
    articles[0].published_at = None
    kept, emb = await prefilter(plan, articles, await _embed(articles))
    assert len(kept) == 3 and emb.shape[0] == 3


@pytest.mark.asyncio
async def test_rerank_applies_scores_threshold_and_cap(fake_llm, make_article, monkeypatch):
    monkeypatch.setattr(settings, "rerank_keep", 2)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    cands = [make_article(title=f"t{i}") for i in range(4)]
    fake_llm.reply = json.dumps({"scores": [{"i": 0, "s": 1}, {"i": 1, "s": 3}, {"i": 2, "s": 2}, {"i": 99, "s": 3}]})
    kept = await rerank(plan, cands)
    assert kept == [cands[1], cands[2]]  # score 3 first, then 2; index 3 missing -> 0; 99 ignored
    assert fake_llm.calls[0]["model"] == settings.rerank_model


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["no json", json.dumps({"nope": []}), TimeoutError("slow")])
async def test_rerank_failures_return_none(fake_llm, make_article, reply):
    fake_llm.reply = reply
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    assert await rerank(plan, [make_article()]) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", [
    json.dumps({"scores": []}),
    json.dumps({"scores": [{"index": 0, "score": 3}]}),  # wrong keys: "i"/"s" expected
])
async def test_rerank_empty_or_malformed_scores_falls_back_to_none(fake_llm, make_article, reply):
    fake_llm.reply = reply
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    assert await rerank(plan, [make_article()]) is None


@pytest.mark.asyncio
async def test_rerank_valid_entries_all_below_threshold_is_empty_not_none(fake_llm, make_article):
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    fake_llm.reply = json.dumps({"scores": [{"i": 0, "s": 1}, {"i": 1, "s": 0}]})
    assert await rerank(plan, [make_article(), make_article()]) == []


def test_parse_scores_rejects_bool_scores():
    assert _parse_scores({"scores": [{"i": 0, "s": True}]}, 2) == {}


@pytest.mark.asyncio
async def test_rerank_disabled_without_key(make_article, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    assert await rerank(plan, [make_article()]) is None


@pytest.mark.asyncio
async def test_rank_articles_falls_back_to_relevance_filter(make_article, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    plan = rule_plan("trade policy")
    articles = [make_article(title="Trade policy shifts", snippet="Tariffs rise."),
                make_article(title="Gallery of photos", snippet="Red carpet.")]
    result = await rank_articles("trade policy", plan, articles, await _embed(articles))
    assert result.reranked is False
    assert [a.title for a in result.articles] == ["Trade policy shifts"]
    assert result.candidates == 1


@pytest.mark.asyncio
async def test_rank_articles_fallback_uses_place_stripped_phrase_not_raw_focus(make_article, monkeypatch):
    # Regression guard: passing the raw focus (with "... in the United
    # States" still attached) into the fallback relevance filter makes
    # "united"/"states" count as keywords, letting an article through on a
    # place-name match alone instead of the actual topic.
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    focus = "Data centers and privacy in the United States"
    plan = rule_plan(focus)
    on_topic = make_article(title="New data center privacy rules unveiled",
                             snippet="Regulators target hyperscale facilities.")
    off_topic = make_article(title="United States privacy debate widens",
                              snippet="Lawmakers discuss privacy broadly nationwide.")
    articles = [on_topic, off_topic]
    result = await rank_articles(focus, plan, articles, await _embed(articles))
    assert [a.title for a in result.articles] == [on_topic.title]


@pytest.mark.asyncio
async def test_rank_articles_uses_rerank_when_available(fake_llm, make_article):
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    articles = [make_article(title="Privacy bill advances"), make_article(title="Privacy app update")]
    fake_llm.reply = json.dumps({"scores": [{"i": 0, "s": 3}, {"i": 1, "s": 0}]})
    result = await rank_articles("privacy", plan, articles, await _embed(articles))
    assert result.reranked is True
    assert len(result.articles) == 1
