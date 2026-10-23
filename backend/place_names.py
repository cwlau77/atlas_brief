"""Place names the planner can name as a story's subject, for the globe's target.

The countries mirror the country entries of frontend/src/lib/centroids.ts, so
the client's resolveRegion can place every name returned here.
"""

from __future__ import annotations

import re

PLACE_NAMES: list[str] = [
    "Afghanistan", "Albania", "Algeria", "Angola", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bangladesh", "Belarus", "Belgium", "Bolivia", "Bosnia", "Brazil", "Bulgaria",
    "Burkina Faso", "Myanmar", "Cambodia", "Cameroon", "Canada", "Chad", "Chile", "China", "Colombia",
    "Congo", "Democratic Republic of the Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Denmark", "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia", "Ethiopia", "Finland", "France",
    "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Guinea", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
    "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
    "Libya", "Lithuania", "Madagascar", "Malawi", "Malaysia", "Mali", "Mauritania", "Mexico", "Moldova",
    "Mongolia", "Montenegro", "Morocco", "Mozambique", "Namibia", "Nepal", "Netherlands", "New Zealand",
    "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan",
    "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar", "Romania", "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone", "Singapore",
    "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
    "Sudan", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Tunisia",
    "Turkey", "Turkmenistan", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States",
    "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
    "Strait of Hormuz", "Red Sea", "Gaza", "West Bank", "Taiwan Strait", "South China Sea", "Black Sea",
    "Sahel", "Horn of Africa", "Kashmir", "Donbas",
]

# Aliases journalists use, mapped to the display name above.
_ALIASES: dict[str, str] = {
    "burma": "Myanmar",
    "drc": "Democratic Republic of the Congo",
    "czech republic": "Czechia",
    "uae": "United Arab Emirates",
    "britain": "United Kingdom",
    "usa": "United States",
}

_BY_KEY: dict[str, str] = {**{n.lower(): n for n in PLACE_NAMES}, **_ALIASES}
_KEYS_BY_LENGTH = sorted(_BY_KEY, key=len, reverse=True)

# "US" and "UK" are places only in capitals or with dots, so the pronoun "us" never matches.
_SHORT_FORMS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?<![A-Za-z])(?:US|U\.S\.)(?![A-Za-z])"), "United States"),
    (re.compile(r"(?<![A-Za-z])(?:UK|U\.K\.)(?![A-Za-z])"), "United Kingdom"),
]


def find_place(text: str) -> str | None:
    """The longest word-bounded known place name in `text`, in display case, or None."""
    low = text.lower()
    for key in _KEYS_BY_LENGTH:
        if re.search(rf"(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])", low):
            return _BY_KEY[key]
    for pattern, name in _SHORT_FORMS:
        if pattern.search(text):
            return name
    return None
