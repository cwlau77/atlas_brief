import json
from types import SimpleNamespace

import pytest

import backend.search_plan as search_plan
from backend.config import settings
from backend.search_plan import SearchPlan, plan_search, rule_plan


def test_data_centers_example_splits_place_pair_and_drops_pronoun():
    plan = rule_plan("Data centers and privacy in the US")
    assert plan.source == "rules"
    assert plan.phrase == "data centers privacy"
    assert plan.country == "US"
    assert plan.queries[0] == '"data centers" privacy'
    assert '"data center" privacy' in plan.queries
    assert {"data centers", "data center", "privacy"} <= set(plan.must_terms)
    every_term = " ".join(plan.queries + plan.must_terms + plan.synonyms)
    assert " us" not in f" {every_term}"
    assert plan.domains == ["general"]


def test_lowercase_in_the_us_is_a_place():
    assert rule_plan("student loans in the us").country == "US"


def test_us_with_periods_and_united_states():
    plan = rule_plan("U.S. chip export rules")
    assert plan.country == "US"
    assert plan.phrase == "chip export rules"
    wildfire = rule_plan("wildfire insurance across the United States")
    assert wildfire.country == "US"
    assert wildfire.phrase == "wildfire insurance"


def test_pronoun_us_is_not_a_place():
    plan = rule_plan("what the tariffs mean for us")
    assert plan.country is None
    assert "us" not in plan.phrase.split()


def test_uk_maps_to_gb_and_eu_stays_a_content_term():
    assert rule_plan("housing costs in the UK").country == "GB"
    eu = rule_plan("EU trade rules")
    assert eu.country is None
    assert "eu" in eu.phrase.split()


def test_entity_focus_keeps_anchor_behavior():
    plan = rule_plan("Regeneron Pharmaceuticals")
    assert plan.queries[0] == '"regeneron pharmaceuticals"'
    assert plan.must_terms == ["regeneron"]


def test_single_word_topic_keeps_aliases():
    plan = rule_plan("climate")
    assert plan.queries == ["climate"]
    assert plan.must_terms == ["climate"]
    assert "net zero" in plan.synonyms


def test_topic_head_focus_uses_head_and_aliases():
    plan = rule_plan("South Asian security")
    assert plan.must_terms == ["security"]
    assert "military" in plan.synonyms
    assert plan.queries[0] == '"south asian security"'


def test_two_word_focus_requires_both_terms_without_exact_phrase():
    plan = rule_plan("lithium mining")
    assert plan.queries == ["lithium mining"]
    assert plan.must_terms == ["lithium", "mining"]


def test_finance_cues_and_tickers():
    assert rule_plan("Nvidia earnings and AI chip stocks").domains == ["finance"]
    plan = rule_plan("$NVDA guidance")
    assert plan.tickers == ["NVDA"]
    assert plan.is_finance
    assert plan.phrase == "guidance"
    assert rule_plan("data centers and privacy in the US").is_finance is False


def test_ticker_only_focus_has_a_phrase():
    plan = rule_plan("$NVDA")
    assert plan.phrase == "nvda"
    assert plan.queries == ["nvda"]


def test_place_only_focus_still_produces_a_plan():
    plan = rule_plan("news in the US")
    assert plan.phrase
    assert plan.queries
    assert plan.country == "US"


def test_us_china_compound_does_not_become_an_exclude_operator():
    plan = rule_plan("US-China trade")
    every_term = [*plan.queries, *plan.must_terms, *plan.synonyms]
    assert not any(term.lstrip('"').startswith("-") for term in every_term)
    assert "china" in plan.phrase
    assert "trade" in plan.phrase


def test_us_steel_and_us_open_do_not_set_country():
    assert rule_plan("US Steel").country is None
    assert rule_plan("US Open").country is None


def test_data_centers_in_the_us_example_unaffected():
    plan = rule_plan("Data centers and privacy in the US")
    assert plan.country == "US"
    assert "us" not in plan.phrase.split()


def test_labor_market_in_america_is_a_us_qualifier():
    plan = rule_plan("labor market in America")
    assert plan.country == "US"
    assert "america" not in plan.must_terms
    every_term = " ".join(plan.queries + plan.must_terms + plan.synonyms)
    assert "america" not in every_term.split()


def test_match_terms_dedupes_and_orders_longest_first():
    plan = SearchPlan(phrase="x", queries=["x"], must_terms=["privacy", "Data Centers"],
                      synonyms=["privacy", "data broker"])
    assert plan.match_terms == ["data centers", "data broker", "privacy"]


class _FakeAnthropic:
    """Stands in for AsyncAnthropic; records calls and returns a canned reply or raises."""
    reply: str | Exception = ""
    calls: list[dict] = []

    def __init__(self, **kwargs):
        self.init_kwargs = kwargs
        self.messages = self

    async def create(self, **kwargs):
        _FakeAnthropic.calls.append(kwargs)
        if isinstance(_FakeAnthropic.reply, Exception):
            raise _FakeAnthropic.reply
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=_FakeAnthropic.reply)])


@pytest.fixture
def fake_llm(monkeypatch):
    _FakeAnthropic.calls = []
    monkeypatch.setattr(search_plan, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "search_plan_enabled", True)
    return _FakeAnthropic


@pytest.mark.asyncio
async def test_llm_plan_is_parsed_and_clamped(fake_llm):
    fake_llm.reply = json.dumps({
        "queries": ["q1", "q2", "q3", "q4", "q5"],
        "must_terms": ["Data Center", "privacy"],
        "synonyms": ["hyperscale", "data broker"],
        "country": "us",
        "domains": ["tech", "sports"],
        "tickers": ["msft", "TOOLONGX"],
    })
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.source == "llm"
    assert plan.queries == ["q1", "q2", "q3"]
    assert plan.must_terms == ["data center", "privacy"]
    assert plan.country == "US"
    assert plan.domains == ["tech"]
    assert plan.tickers == ["MSFT"]
    assert plan.phrase == "data centers privacy"  # phrase always comes from the rule plan
    assert fake_llm.calls[0]["model"] == settings.search_plan_model


@pytest.mark.asyncio
async def test_llm_null_country_keeps_rule_country(fake_llm):
    fake_llm.reply = json.dumps({"queries": ["data center privacy"], "must_terms": ["privacy"],
                                 "synonyms": [], "country": None, "domains": ["general"], "tickers": []})
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.country == "US"


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["not json at all", json.dumps({"queries": []}), TimeoutError("slow")])
async def test_llm_failures_fall_back_to_rules(fake_llm, reply):
    fake_llm.reply = reply
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.source == "rules"
    assert plan.queries[0] == '"data centers" privacy'


@pytest.mark.asyncio
async def test_no_key_or_disabled_uses_rules_without_calling_llm(fake_llm, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    assert (await plan_search("climate")).source == "rules"
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "search_plan_enabled", False)
    assert (await plan_search("climate")).source == "rules"
    assert fake_llm.calls == []
