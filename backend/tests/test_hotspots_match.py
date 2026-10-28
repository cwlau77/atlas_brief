import csv
import time

import pytest
from backend.hotspots_match import COUNTRIES, COUNTRIES_CSV, countries_named, country_terms


@pytest.mark.parametrize("text,expected", [
    ("Drone strikes hit Kyiv power grid", {"UA"}),
    ("Ukrainian and Russian negotiators meet in Istanbul", {"UA", "RU", "TR"}),
    ("U.S. and UK warships enter the Red Sea", {"US", "GB"}),
    ("Ceasefire monitors report violations in Gaza", {"PS"}),
    ("Türkiye hosts talks; Turkish officials upbeat", {"TR"}),
    ("Turkey sends aid convoy to Syria", {"TR", "SY"}),
    ("Kinshasa accuses M23 of breaking DRC truce", {"CD"}),
    ("Tbilisi protests grow as Georgian government stalls", {"GE"}),
    ("Chad closes border with Sudan", {"TD", "SD"}),
    ("Jordan's King Abdullah meets Egyptian president", {"JO", "EG"}),
])
def test_countries_named_matches(text, expected):
    assert countries_named(text) == expected


@pytest.mark.parametrize("text", [
    "How to roast a turkey for Thanksgiving",
    "Georgia governor signs election bill in Atlanta",
    "Michael Jordan's sneakers sell at auction",
    "Chad Smith joins the board",
    "Washington state wildfire forces evacuations",
    "Guinea pig cafe opens in Tokyo suburb",  # Tokyo still counts, guinea pig does not
])
def test_ambiguous_words_do_not_match(text):
    found = countries_named(text)
    assert not found & {"TR", "GE", "JO", "TD", "US", "GN"}


def test_matching_is_whole_word():
    assert countries_named("Omani officials") == {"OM"}
    assert countries_named("Romania's economy") == {"RO"}  # never Oman


def test_world_atlas_ids_are_zero_padded():
    assert COUNTRIES["BR"].iso_numeric == "076"
    assert COUNTRIES["UA"].iso_numeric == "804"


@pytest.mark.parametrize("text,expected", [
    ("Turkey dinner sales rise", set()),
    ("Georgia's government faces protests", {"GE"}),
    ("Nigerian troops enter the Niger Delta", {"NG"}),
    ("Niger coup leaders meet Nigeria envoy", {"NE", "NG"}),
    ("Equatorial Guinea and Guinea-Bissau sign deal", {"GQ", "GW"}),
    ("Papua New Guinea quake", {"PG"}),
    ("Brazzaville hosts Congo talks", {"CG"}),
    ("Congo rebels advance", {"CD"}),
    ("New Mexico storm; Mexican president responds", {"MX"}),
    ("Latin America summit in Brasilia", {"BR"}),
    ("Russia-Ukraine war enters new phase", {"RU", "UA"}),
    ("Northern Ireland talks stall", {"GB"}),
    ("South Sudan and Sudan agree truce", {"SS", "SD"}),
    ("Dominican Republic and Dominica", {"DO", "DM"}),
    ("Cyclone hits the Indian Ocean", set()),
    ("New England Patriots win", set()),
    ("Turks and Caicos election", set()),
    ("American Airlines cancels flights", set()),
    ("American football draft opens", set()),
    ("Indian Wells final postponed", set()),
    ("American Samoa storm", set()),
    ("Turks rally in Ankara", {"TR"}),
    ("American envoy visits England", {"US", "GB"}),
])
def test_more_cases(text, expected):
    assert countries_named(text) == expected


def test_gazetteer_shape():
    with COUNTRIES_CSV.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == len(COUNTRIES) >= 197
    assert {"PS", "XK", "TW", "HK"} <= set(COUNTRIES)
    numerics = [c.iso_numeric for c in COUNTRIES.values() if c.iso_numeric]
    assert len(numerics) == len(set(numerics)) and all(len(n) == 3 for n in numerics)
    assert COUNTRIES["TR"].name == "Turkey" and COUNTRIES["CD"].name == "DR Congo"


def test_country_terms_are_lower_cased_words():
    assert {"united", "states", "american", "americans"} <= country_terms("US")
    assert {"turkey", "turkiye", "türkiye", "ankara"} <= country_terms("TR")
    assert country_terms("ZZ") == set()


def test_matching_is_fast_enough():
    text = "Ukrainian and Russian negotiators meet in Istanbul as talks continue"
    start = time.perf_counter()
    for _ in range(500):
        countries_named(text)
    assert time.perf_counter() - start < 2
