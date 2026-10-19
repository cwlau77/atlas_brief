"""Resolve a model-named "City, Country" to coordinates from the bundled GeoNames list.

Coordinates always come from backend/data/cities.csv, never from the model. A
city is only accepted when its country is among the development's regions,
unless one of those regions is a sea or a supranational area.
"""

from __future__ import annotations

import csv
import unicodedata
from pathlib import Path
from typing import NamedTuple

from backend.models import Place

CITIES_CSV = Path(__file__).resolve().parent / "data" / "cities.csv"

SEA_OR_SUPRANATIONAL = {
    "red sea", "gulf states", "middle east", "europe", "european union", "africa", "asia",
    "persian gulf", "mediterranean", "south china sea", "black sea", "arctic", "global",
}

# Region and country spellings the model uses that differ from GeoNames' country names.
_COUNTRY_ALIASES = {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "america": "US", "united states of america": "US",
    "uk": "GB", "u.k.": "GB", "britain": "GB", "great britain": "GB", "england": "GB",
    "scotland": "GB", "wales": "GB", "northern ireland": "GB",
    "palestine": "PS", "gaza": "PS", "gaza strip": "PS", "west bank": "PS", "palestinian territories": "PS",
    "czech republic": "CZ", "turkiye": "TR", "burma": "MM", "uae": "AE", "ivory coast": "CI",
    "cote d'ivoire": "CI", "drc": "CD", "dr congo": "CD", "democratic republic of the congo": "CD",
    "russian federation": "RU",
}


class _City(NamedTuple):
    name: str
    country_code: str
    country_name: str
    lat: float
    lng: float
    population: int


def _fold(text: str) -> str:
    stripped = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return " ".join(stripped.casefold().split())


def _load() -> tuple[dict[str, list[tuple[int, _City]]], dict[str, str]]:
    """Index every name, ascii name and alternate (tier 0 = primary, 1 = alternate),
    plus a folded country name -> code map."""
    by_name: dict[str, list[tuple[int, _City]]] = {}
    countries: dict[str, str] = {}
    with CITIES_CSV.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            city = _City(row["name"], row["country_code"], row["country_name"],
                         float(row["lat"]), float(row["lng"]), int(row["population"]))
            countries[_fold(city.country_name)] = city.country_code
            names = [(0, row["name"]), (0, row["ascii_name"])]
            names += [(1, alt) for alt in row["alt_names"].split("|") if alt]
            seen: set[str] = set()
            for tier, name in names:
                key = _fold(name)
                if key and key not in seen:
                    seen.add(key)
                    by_name.setdefault(key, []).append((tier, city))
    return by_name, countries


_BY_NAME, _COUNTRY_CODES = _load()


def _country_codes(term: str) -> set[str]:
    key = _fold(term)
    codes = {code for code in (_COUNTRY_ALIASES.get(key), _COUNTRY_CODES.get(key)) if code}
    if len(key) == 2 and key.upper() in _COUNTRY_CODES.values():
        codes.add(key.upper())
    return codes


def resolve_city(city: str | None, regions: list[str]) -> Place | None:
    """The best-matching city for "City" or "City, Country", or None.

    Exact names beat alternate names, then the highest population wins.
    """
    if not isinstance(city, str):
        return None
    parts = [p.strip() for p in city.split(",") if p.strip()]
    if not parts:
        return None
    candidates = _BY_NAME.get(_fold(parts[0]), [])
    if len(parts) > 1:
        wanted = _country_codes(parts[-1])
        candidates = [(tier, c) for tier, c in candidates if c.country_code in wanted]
    if not candidates:
        return None
    _, best = min(candidates, key=lambda tc: (tc[0], -tc[1].population))

    folded_regions = {_fold(r) for r in regions if isinstance(r, str)}
    if not folded_regions & SEA_OR_SUPRANATIONAL:
        allowed = set().union(*(_country_codes(r) for r in folded_regions)) if folded_regions else set()
        if best.country_code not in allowed:
            return None
    return Place(name=best.name, country=best.country_name, lat=best.lat, lng=best.lng)
