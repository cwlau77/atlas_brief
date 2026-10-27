import pytest

from backend.config import Settings
from backend.models import Briefing
from backend.synthesis.briefing import _fallback_briefing, briefing_from_data

QUOTE_SNIPPET = "“Premiums are likely to remain elevated well into 2027,” brokers said."


def _outlook(make_article, items, *, key="trends", articles=None):
    articles = articles or [make_article(title="Insurers weigh Red Sea risk", snippet=QUOTE_SNIPPET, url="https://ex.com/1")]
    return briefing_from_data({key: items}, "shipping", articles), articles


def test_reported_quote_found_in_cited_article_stays_reported(make_article):
    b, _ = _outlook(make_article, [{
        "statement": "Premiums stay high.", "basis": "reported",
        "quote": " premiums are  likely to remain elevated well into 2027… ", "sources": [1],
    }])
    item = b.trends[0]
    assert item.basis == "reported"
    assert item.quote == "premiums are  likely to remain elevated well into 2027…"
    assert len(item.sources) == 1


def test_quote_spanning_title_and_snippet_verifies(make_article):
    b, _ = _outlook(make_article, [{
        "statement": "S", "basis": "reported", "quote": "Red Sea risk “Premiums are", "sources": [1],
    }])
    assert b.trends[0].basis == "reported"


def test_reported_sources_narrowed_to_matching_article(make_article):
    articles = [
        make_article(title="Unrelated", snippet="Nothing here at all", url="https://ex.com/1"),
        make_article(title="Insurers weigh Red Sea risk", snippet=QUOTE_SNIPPET, url="https://ex.com/2"),
    ]
    b, _ = _outlook(make_article, [{
        "statement": "S", "basis": "reported", "quote": "likely to remain elevated well into 2027", "sources": [1, 2],
    }], articles=articles)
    assert [s.url for s in b.trends[0].sources] == ["https://ex.com/2"]


@pytest.mark.parametrize("quote, sources, kept", [
    ("insurers see prices staying high next year", [1], 1),   # a paraphrase
    ("well into 2027", [1], 1),                                # under 4 words
    ("Ceasefire talks resume in Doha today", [1], 1),          # only in uncited article 2
    (None, [1], 1),
    ("likely to remain elevated well into 2027", ["1"], 0),
    ("likely to remain elevated well into 2027", [1.0], 0),
])
def test_paraphrase_is_downgraded(make_article, quote, sources, kept):
    articles = [
        make_article(title="Insurers weigh Red Sea risk", snippet=QUOTE_SNIPPET, url="https://ex.com/1"),
        make_article(title="Ceasefire talks resume in Doha today", snippet="Mediators return.", url="https://ex.com/2"),
    ]
    b, _ = _outlook(make_article, [{"statement": "S", "basis": "reported", "quote": quote, "sources": sources}],
                    articles=articles)
    item = b.trends[0]
    assert item.basis == "assessment"
    assert item.quote is None
    assert len(item.sources) == kept


def test_unknown_basis_is_assessment(make_article):
    b, _ = _outlook(make_article, [{"statement": "S", "basis": "rumour", "sources": [1]}])
    assert b.trends[0].basis == "assessment"


def test_watch_for_only_on_implications(make_article):
    trend, _ = _outlook(make_article, [{"statement": "S", "basis": "assessment", "watch_for": "W", "sources": [1]}])
    assert trend.trends[0].watch_for is None
    imp, _ = _outlook(make_article, [{"statement": "S", "basis": "assessment", "watch_for": "W", "sources": [1]}],
                      key="implications")
    assert imp.implications[0].watch_for == "W"
    empty, _ = _outlook(make_article, [{"statement": "S", "basis": "assessment", "watch_for": "", "sources": [1]}],
                        key="implications")
    assert empty.implications[0].watch_for is None


def test_missing_statement_is_shape_error(make_article):
    with pytest.raises(KeyError):
        _outlook(make_article, [{"basis": "assessment"}])


def test_older_briefing_dict_without_outlook_validates():
    b = Briefing.model_validate({
        "focus": "f", "generated_at": "2026-10-01T00:00:00Z", "key_developments": [], "emerging_tensions": [],
        "contradictions": [], "priority_alerts": [], "recommended_readings": [], "article_count": 0,
        "source_breakdown": {},
    })
    assert b.trends == [] and b.implications == []


def test_fallback_briefing_has_no_outlook(make_article):
    b = _fallback_briefing("trade", [make_article()])
    assert b.trends == [] and b.implications == []


def test_config_outlook_model_defaults_to_haiku(tmp_path, monkeypatch):
    monkeypatch.setitem(Settings.model_config, "env_file", str(tmp_path / "none.env"))
    monkeypatch.delenv("OUTLOOK_MODEL", raising=False)
    assert Settings().outlook_model == "claude-haiku-4-5"


# --- Settling links ---

from backend.models import KeyDevelopment, OutlookItem, SourceCitation  # noqa: E402
from backend.synthesis.briefing import settle_outlook  # noqa: E402


def _cite(url):
    return SourceCitation(outlet="O", url=url)


def _dev(url):
    return KeyDevelopment(headline="H", summary="S", regions=[], sources=[_cite(url)])


def test_overlap_fallback_links_devs_sharing_a_source_url():
    item = OutlookItem(statement="S", basis="assessment", sources=[_cite("u2")])
    assert settle_outlook([item], [_dev("u1"), _dev("u2")])[0].related_developments == [1]


def test_link_result_wins_over_overlap():
    item = OutlookItem(statement="S", basis="assessment", sources=[_cite("u2")], related_developments=[0])
    assert settle_outlook([item], [_dev("u1"), _dev("u2")])[0].related_developments == [0]


def test_unlinked_assessment_dropped_unlinked_reported_kept():
    assessment = OutlookItem(statement="A", basis="assessment", sources=[_cite("x")])
    reported = OutlookItem(statement="R", basis="reported", quote="q q q q", sources=[_cite("x")])
    settled = settle_outlook([assessment, reported], [_dev("u1")])
    assert [i.statement for i in settled] == ["R"]
    assert settled[0].related_developments == []


def test_reported_without_sources_downgraded_then_dropped_if_unlinked():
    linked = OutlookItem(statement="L", basis="reported", quote="q q q q", sources=[], related_developments=[0])
    unlinked = OutlookItem(statement="U", basis="reported", quote="q q q q", sources=[])
    settled = settle_outlook([linked, unlinked], [_dev("u1")])
    assert [(i.statement, i.basis, i.quote) for i in settled] == [("L", "assessment", None)]
