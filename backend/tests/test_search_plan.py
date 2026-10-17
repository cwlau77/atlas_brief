from backend.search_plan import SearchPlan, rule_plan


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


def test_match_terms_dedupes_and_orders_longest_first():
    plan = SearchPlan(phrase="x", queries=["x"], must_terms=["privacy", "Data Centers"],
                      synonyms=["privacy", "data broker"])
    assert plan.match_terms == ["data centers", "data broker", "privacy"]
