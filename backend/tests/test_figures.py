import pytest

from backend.models import KeyDevelopment
from backend.synthesis.briefing import _parse_figures

CEPR = ("China's average tariff on US goods rose from around 8% to roughly 20%, "
        "while its tariffs on other origins remained below 10%.")


def test_verbatim_figure_kept(make_article):
    a = make_article(title="Sudan: 19.5 Million Face Acute Hunger", snippet="")
    [f] = _parse_figures([{"figure": "19.5 Million", "label": "face acute hunger", "kind": "people", "source": 1}], [a])
    assert f.figure == "19.5 Million" and f.kind == "people" and f.source.url == a.url


@pytest.mark.parametrize("figure,text", [("4.5%", "growth of 14.5%"), ("20", "about 200 ships"),
                                         ("20", "rose 20.5 points"), ("1,200", "1,2000 units")])
def test_figure_inside_longer_number_dropped(make_article, figure, text):
    assert _parse_figures([{"figure": figure, "label": "x", "kind": "count", "source": 1}],
                          [make_article(title=text, snippet="")]) == []


@pytest.mark.parametrize("figure,text", [("20", "rose to 20% this year"), ("5 billion", "a $5 billion zone"),
                                         ("5", "a $5 billion zone"), ("3%", "prices fell -3% in May")])
def test_figure_missing_its_unit_or_sign_dropped(make_article, figure, text):
    assert _parse_figures([{"figure": figure, "label": "x", "kind": "count", "source": 1}],
                          [make_article(title=text, snippet="")]) == []


def test_signed_figure_kept_when_article_has_the_sign(make_article):
    [f] = _parse_figures([{"figure": "-3%", "label": "x", "kind": "change", "source": 1}],
                         [make_article(title="prices fell -3% in May", snippet="")])
    assert f.figure == "-3%"


def test_figure_with_sign_the_article_lacks_dropped(make_article):
    assert _parse_figures([{"figure": "-3%", "label": "x", "kind": "change", "source": 1}],
                          [make_article(title="prices rose 3% in May", snippet="")]) == []


@pytest.mark.parametrize("given,shown", [("8%", "around 8%"), ("20%", "roughly 20%"), ("10%", "below 10%")])
def test_hedge_restored_from_article(make_article, given, shown):
    [f] = _parse_figures([{"figure": given, "label": "tariff", "kind": "share", "source": 1}],
                         [make_article(title="Tariff evasion", snippet=CEPR)])
    assert f.figure == shown


def test_two_word_hedge_restored(make_article):
    [f] = _parse_figures([{"figure": "43 hospitals", "label": "targeted", "kind": "count", "source": 1}],
                         [make_article(snippet="RSF targeted at least 43 hospitals in el-Fasher.")])
    assert f.figure == "at least 43 hospitals"


def test_hedge_not_doubled(make_article):
    [f] = _parse_figures([{"figure": "around 8%", "label": "t", "kind": "share", "source": 1}],
                         [make_article(snippet=CEPR)])
    assert f.figure == "around 8%"


@pytest.mark.parametrize("item", [
    {"figure": "thousands", "label": "x", "source": 1},             # no digit
    {"figure": "34 million", "label": "x", "source": 1},            # not in article
    {"figure": "8%", "label": "x", "source": 9},                    # out of range
    {"figure": "8%", "label": "x", "source": {"url": "https://e"}}, # legacy dict
    {"figure": "8%", "label": "", "source": 1},                     # empty label
    {"figure": "8" * 41, "label": "x", "source": 1},                # too long
    "not a dict",
])
def test_bad_item_dropped_never_raises(make_article, item):
    assert _parse_figures([item], [make_article(snippet=CEPR)]) == []


def test_good_items_survive_a_bad_neighbour(make_article):
    a = make_article(snippet=CEPR)
    out = _parse_figures([{"figure": "8%", "label": "t", "source": 1}, None,
                          {"figure": "20%", "label": "t", "source": 1}], [a])
    assert [f.figure for f in out] == ["around 8%", "roughly 20%"]


def test_period_kept_only_when_verbatim(make_article):
    a = make_article(snippet="Beginning in 2018 the tariff rose to roughly 20%.")
    [f] = _parse_figures([{"figure": "20%", "label": "t", "period": "in 2018", "source": 1}], [a])
    [g] = _parse_figures([{"figure": "20%", "label": "t", "period": "since 2016", "source": 1}], [a])
    assert f.period == "in 2018" and g.period is None


def test_unknown_kind_becomes_none_and_duplicates_collapse(make_article):
    a = make_article(snippet=CEPR)
    out = _parse_figures([{"figure": "8%", "label": "a", "kind": "ratio", "source": 1},
                          {"figure": "around 8%", "label": "b", "kind": "share", "source": 1}], [a])
    assert len(out) == 1 and out[0].kind is None


def test_label_capped_at_80_on_word_boundary(make_article):
    [f] = _parse_figures([{"figure": "8%", "label": "word " * 30, "source": 1}], [make_article(snippet=CEPR)])
    assert len(f.label) <= 80 and not f.label.endswith(" ")


def test_non_list_is_shape_error(make_article):
    with pytest.raises(TypeError):
        _parse_figures({"figure": "8%"}, [make_article()])


def test_key_development_without_figures_validates():
    d = KeyDevelopment(headline="h", summary="s", regions=[], sources=[])
    assert d.key_figures == []
