import pytest

from backend.places import SEA_OR_SUPRANATIONAL, resolve_city


def test_resolves_city_and_country_within_its_regions():
    place = resolve_city("Aden, Yemen", ["Yemen", "Red Sea"])
    assert place.name == "Aden" and place.country == "Yemen"
    assert abs(place.lat - 12.8) < 0.5 and abs(place.lng - 45.0) < 0.5


def test_matching_ignores_case_and_accents():
    a = resolve_city("são paulo, brazil", ["Brazil"])
    b = resolve_city("Sao Paulo, Brazil", ["Brazil"])
    assert a is not None and a == b
    assert a.name == "São Paulo"


def test_highest_population_wins_without_a_country():
    assert resolve_city("Alexandria", ["Egypt"]).country == "Egypt"


def test_alternate_names_resolve():
    assert resolve_city("Kiev, Ukraine", ["Ukraine"]).name == "Kyiv"
    assert resolve_city("Hodeidah, Yemen", ["Yemen"]).lng == pytest.approx(42.95, abs=0.1)


def test_region_mismatch_is_dropped():
    assert resolve_city("Aden, Yemen", ["Egypt"]) is None
    assert resolve_city("Aden, Yemen", []) is None


def test_sea_or_supranational_region_exempts_the_check():
    assert resolve_city("Aden, Yemen", ["Red Sea"]).name == "Aden"
    assert resolve_city("Aden, Yemen", ["MIDDLE EAST"]).name == "Aden"
    assert "persian gulf" in SEA_OR_SUPRANATIONAL


def test_country_names_match_common_region_spellings():
    assert resolve_city("Gaza City, Palestine", ["Gaza", "Israel"]).name == "Gaza"
    assert resolve_city("Seattle, USA", ["US"]).country == "United States"


@pytest.mark.parametrize("city", ["Atlantis", "", None])
def test_unknown_city_is_none(city):
    assert resolve_city(city, ["Greece", "Yemen"]) is None


def test_unrecognised_trailing_part_leaves_the_regions_to_decide():
    # "City, State" datelines: the state is not a country, so the regions constrain the match.
    assert resolve_city("Aden, Narnia", ["Greece"]) is None
    assert resolve_city("Aden, Narnia", ["Yemen"]).name == "Aden"


@pytest.mark.parametrize("city,regions,name", [
    ("New York, USA", ["United States"], "New York City"),
    ("New York, United States", ["United States"], "New York City"),
    ("Washington, D.C.", ["United States"], "Washington"),
    ("Washington DC, USA", ["US"], "Washington"),
    ("San Francisco, California", ["United States"], "San Francisco"),
    ("Kinshasa, Democratic Republic of the Congo", ["Democratic Republic of Congo"], "Kinshasa"),
    ("Hong Kong, China", ["China"], "Hong Kong"),
    ("Bandar Abbas, Iran", ["Strait of Hormuz"], "Bandar Abbas"),
])
def test_common_datelines_resolve(city, regions, name):
    place = resolve_city(city, regions)
    assert place is not None and place.name == name


def test_regions_pick_among_same_named_cities():
    assert resolve_city("Alexandria", ["United States"]).country == "United States"
    assert resolve_city("Alexandria", ["Egypt"]).country == "Egypt"
