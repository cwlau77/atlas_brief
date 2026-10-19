"""Regenerate backend/data/cities.csv from GeoNames (CC BY 4.0, https://www.geonames.org/).

Keeps cities with population >= 100,000, sorted by population descending, with
up to five Latin-script alternate names so common spellings (Kiev/Kyiv,
Bombay/Mumbai) still resolve. Run from the repo root:

    .venv/bin/python backend/scripts/build_cities.py
"""

from __future__ import annotations

import csv
import io
import re
import ssl
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
COUNTRIES_URL = "https://download.geonames.org/export/dump/countryInfo.txt"
OUT = Path(__file__).resolve().parents[1] / "data" / "cities.csv"
MIN_POPULATION = 100_000
MAX_ALT_NAMES = 5
COLUMNS = ["name", "ascii_name", "alt_names", "country_code", "country_name", "lat", "lng", "population"]

# Capitalised ASCII names (spaces, apostrophes, hyphens, dots); lowercase entries in
# GeoNames are mostly transliterations from other scripts, all-caps ones are codes.
_ENGLISHY = re.compile(r"^[A-Z][A-Za-z '\-.]{2,39}$")

# English exonyms and former names that news copy still uses; GeoNames lists them
# among hundreds of alternates with no language tag, so they are pinned here.
EXONYMS = {
    "Kyiv": ["Kiev"], "Mumbai": ["Bombay"], "Kolkata": ["Calcutta"], "Chennai": ["Madras"],
    "Bengaluru": ["Bangalore"], "Ho Chi Minh City": ["Saigon"], "Yangon": ["Rangoon"],
    "Beijing": ["Peking"], "Guangzhou": ["Canton"], "Kharkiv": ["Kharkov"], "Odesa": ["Odessa"],
    "Gaza": ["Gaza City"], "Al Hudaydah": ["Hodeidah", "Hudaydah"], "Sanaa": ["Sana'a", "Sana"],
    "Mosul": ["Al Mawsil"], "Aleppo": ["Halab"], "Almaty": ["Alma-Ata"], "Chisinau": ["Kishinev"],
    "Vilnius": ["Vilna"], "Ulan Bator": ["Ulaanbaatar"], "Dnipro": ["Dnipropetrovsk"],
    "Zaporizhzhia": ["Zaporizhia", "Zaporozhye"], "Mykolaiv": ["Nikolaev"], "Lviv": ["Lvov"],
}


def _fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "AtlasBrief/1.0 build_cities"})
    try:
        import certifi  # installed with httpx; python.org builds ship without system CA certs
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=120, context=context) as resp:
        return resp.read()


def _fold(text: str) -> str:
    stripped = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return " ".join(stripped.casefold().split())


def _alt_names(raw: str, name: str, ascii_name: str) -> list[str]:
    taken = {_fold(name), _fold(ascii_name)}
    picked: list[str] = []
    pinned = EXONYMS.get(name, []) + EXONYMS.get(ascii_name, [])
    # Then shortest first: short variants are the everyday spellings, long ones are descriptive.
    rest = sorted({a.strip() for a in raw.split(",") if a.strip()}, key=lambda a: (len(a), a))
    for alt in pinned + rest:
        if alt not in pinned and (not _ENGLISHY.match(alt) or alt.isupper()):
            continue
        if _fold(alt) in taken:
            continue
        taken.add(_fold(alt))
        picked.append(alt)
        if len(picked) == MAX_ALT_NAMES:
            break
    return picked


def main() -> None:
    countries: dict[str, str] = {}
    for line in _fetch(COUNTRIES_URL).decode("utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        cols = line.split("\t")
        countries[cols[0]] = cols[4]

    with zipfile.ZipFile(io.BytesIO(_fetch(CITIES_URL))) as zf:
        text = zf.read("cities15000.txt").decode("utf-8")

    rows = []
    for line in text.splitlines():
        cols = line.split("\t")
        population = int(cols[14] or 0)
        if population < MIN_POPULATION:
            continue
        name, ascii_name = cols[1], cols[2]
        rows.append({
            "name": name,
            "ascii_name": ascii_name,
            "alt_names": "|".join(_alt_names(cols[3], name, ascii_name)),
            "country_code": cols[8],
            "country_name": countries.get(cols[8], ""),
            "lat": f"{float(cols[4]):.4f}",
            "lng": f"{float(cols[5]):.4f}",
            "population": population,
        })
    rows.sort(key=lambda r: (-r["population"], r["name"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"wrote {len(rows)} rows to {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
