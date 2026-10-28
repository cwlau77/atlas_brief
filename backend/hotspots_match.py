"""Deterministic country matcher for the Hotspots page: gazetteer plus context rules.

Case-sensitive on purpose (country names are proper nouns); where a name is also an
everyday word or a person's name the rules below choose a missed match over a false one.
"""
import csv
import re
import unicodedata
from pathlib import Path
from typing import NamedTuple

COUNTRIES_CSV = Path(__file__).parent / "data" / "countries.csv"


class Country(NamedTuple):
    iso2: str
    iso_numeric: str  # zero-padded, matching world-atlas ids; "" if none
    name: str
    terms: tuple[str, ...]  # names, aliases, demonyms, capital


def _fold(text: str) -> str:
    """Strip diacritics and curly apostrophes, keeping case."""
    text = text.replace("’", "'").replace("‘", "'")
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def _load() -> dict[str, Country]:
    countries: dict[str, Country] = {}
    with COUNTRIES_CSV.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            terms: list[str] = [row["name"]]
            for col in ("aliases", "demonyms"):
                terms += [t for t in row[col].split("|") if t]
            if row["capital"]:
                terms.append(row["capital"])
            countries[row["iso2"]] = Country(row["iso2"], row["iso_numeric"], row["name"],
                                             tuple(dict.fromkeys(terms)))
    return countries


COUNTRIES: dict[str, Country] = _load()

# "Congo" and "Congolese" mean DR Congo unless the text points at Brazzaville.
_CONGO_BARE = {"Congo", "Congolese"}
_CONGO_REPUBLIC = re.compile(r"Brazzaville|Republic of (?:the )?Congo|Congo[- ]Brazzaville")


def _build() -> tuple[re.Pattern[str], dict[str, str]]:
    owner: dict[str, str] = {}
    for c in COUNTRIES.values():
        for term in c.terms:
            if c.iso2 == "CG" and term == "Congo":
                continue
            owner.setdefault(_fold(term), c.iso2)
    alternation = "|".join(re.escape(t) for t in sorted(owner, key=len, reverse=True))
    return re.compile(rf"(?<!\w)(?:{alternation})(?!\w)"), owner


_PATTERN, _OWNER = _build()

# Name rules, tested against the text just before / after a match.
_VETO_BEFORE = {
    "Mexico": re.compile(r"(?:New|Gulf of) $"),
    "Guinea": re.compile(r"New $"),
    "England": re.compile(r"New $"),
    "Samoa": re.compile(r"American $"),
    **{t: re.compile(r"(?:Latin|South|North|Central) $") for t in ("America", "American", "Americans")},
}
_VETO_AFTER = {
    "Guinea": re.compile(r" pigs?\b"),
    "Indian": re.compile(r" (?:Ocean|Wells)\b"),
    "Turks": re.compile(r" and Caicos\b"),
    "American": re.compile(r" (?:Airlines|Express|football|Idol|Samoa)\b"),
}
_FOOD = re.compile(r"\b(?:dinner|roast|recipes?|thanksgiving|stuffing|gravy|sandwich(?:es)?|bacon|legs?|"
                   r"breasts?|farms?|farmers?|pardon|trot)\b", re.I)
_FUNCTION_WORDS = frozenset(
    "In At To From And Of The For With On By After Over Near Across Into Between Against Inside Outside "
    "Despite Amid Via Under Through Toward Towards About As Within Without Beyond Around Along Before "
    "During Since Until Upon Meanwhile But Or Nor While Why How When Where What Is Are Was Will Can "
    "Could Would Should Visit Visits Trip".split())
_PREV_WORD = re.compile(r"([A-Z][\w'.-]*) $")
_NEXT_CAPITAL = re.compile(r" [A-Z][a-z]")
_US_GEORGIA = re.compile(r"\b(?:Atlanta|Savannah|governor|Governor|county|County|Senate)\b|"
                         r"state of Georgia|Georgia state\b|Georgia Tech|Peach State")
_GEORGIA_COUNTRY = re.compile(r"Tbilisi|Georgian|Abkhazia|South Ossetia|Kutaisi|Batumi|Republic of Georgia|"
                              r"country of Georgia|Georgia(?:'s)? (?:government|president|prime minister|"
                              r"parliament|ruling party|opposition)")


def _keep(term: str, text: str, start: int, end: int) -> bool:
    before, after = text[:start], text[end:]
    veto = _VETO_BEFORE.get(term)
    if veto and veto.search(before):
        return False
    veto = _VETO_AFTER.get(term)
    if veto and veto.match(after):
        return False
    if term == "Turkey":
        near_before = " ".join(before.split()[-3:])
        near_after = " ".join(after.split()[:3])
        return not _FOOD.search(near_before + " " + near_after)
    if term in ("Jordan", "Chad"):
        prev = _PREV_WORD.search(before)
        if prev and prev.group(1) not in _FUNCTION_WORDS:
            return False
        return not _NEXT_CAPITAL.match(after)  # "Jordan's King" passes, "Chad Smith" does not
    if term == "Georgia":
        return not _US_GEORGIA.search(text) and bool(_GEORGIA_COUNTRY.search(text))
    if term in ("Georgian", "Georgians"):
        return not _US_GEORGIA.search(text)  # "Georgian voters in Atlanta" are the US state's
    return True


def countries_named(text: str) -> set[str]:
    """ISO2 codes of the countries a headline or snippet names."""
    text = _fold(text)
    found: set[str] = set()
    for m in _PATTERN.finditer(text):
        term = m.group(0)
        if not _keep(term, text, m.start(), m.end()):
            continue
        if term in _CONGO_BARE and _OWNER[term] == "CD" and _CONGO_REPUBLIC.search(text):
            continue  # the Brazzaville evidence already named CG
        found.add(_OWNER[term])
    return found


def country_terms(iso2: str) -> set[str]:
    """Lower-cased words of a country's names, aliases, demonyms and capital."""
    country = COUNTRIES.get(iso2)
    if country is None:
        return set()
    words: set[str] = set()
    for term in country.terms:
        for form in (term, _fold(term)):
            words.update(re.findall(r"[^\W_]+", form.lower()))
    return words
