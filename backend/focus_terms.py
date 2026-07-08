"""Shared helpers for broadening focus phrases into practical search/filter terms."""

from __future__ import annotations

import re

try:
    from wordfreq import zipf_frequency
except ImportError:  # pragma: no cover — dependency is pinned, but degrade gracefully
    zipf_frequency = None

# Zipf frequency at/above which a token counts as ordinary English rather than
# a distinctive entity name. Calibrated against real focuses: "regeneron" 1.7
# and "streamer" 3.0 must fall below it; "pharmaceuticals" 3.5 and
# "university" 5.4 must not.
_GENERIC_ZIPF = 3.4

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "by", "with",
    "from", "at", "as", "is", "are", "was", "were", "be", "been", "news", "world",
    "update", "daily", "briefing", "focus", "about", "over", "into", "amid",
}

_TERM_ALIASES: dict[str, list[str]] = {
    "climate": [
        "climate",
        "climate change",
        "emissions",
        "carbon",
        "net zero",
        "renewable",
        "renewables",
        "clean energy",
        "energy transition",
        "cop",
    ],
    "energy": [
        "energy",
        "power",
        "electricity",
        "oil",
        "gas",
        "renewable",
        "renewables",
        "grid",
    ],
    "security": [
        "security",
        "defense",
        "military",
        "conflict",
        "ceasefire",
        "troops",
        "sanctions",
        "missile",
    ],
    "trade": [
        "trade",
        "tariff",
        "tariffs",
        "exports",
        "imports",
        "supply chain",
        "customs",
    ],
    "migration": [
        "migration",
        "migrant",
        "migrants",
        "refugee",
        "refugees",
        "asylum",
        "border",
    ],
}


def _normalize_focus_tokens(focus: str) -> list[str]:
    raw = [w.strip(".,;:!?()[]\"'").lower() for w in focus.split()]
    return [w for w in raw if w and w not in _STOPWORDS and len(w) >= 2]


def extract_focus_terms(focus: str, *, include_phrase: bool = True) -> list[str]:
    """Return deduplicated focus terms, including pragmatic aliases for broad topics."""
    normalized_focus = " ".join(_normalize_focus_tokens(focus))
    tokens = _normalize_focus_tokens(focus)

    terms: list[str] = []
    if include_phrase and normalized_focus:
        terms.append(normalized_focus)

    for token in tokens:
        if token not in terms:
            terms.append(token)
        for alias in _TERM_ALIASES.get(token, []):
            if alias not in terms:
                terms.append(alias)

    # Prefer longer/more specific phrases first so substring matching is less noisy.
    return sorted(terms, key=lambda term: (-len(term), term))


def normalize_focus_phrase(focus: str) -> str:
    """The full focus phrase, normalized the same way tokens are."""
    return " ".join(_normalize_focus_tokens(focus))


def distinctive_tokens(focus: str) -> set[str]:
    """Focus tokens that are rare enough in English to act as entity anchors.

    "Regeneron Pharmaceuticals" → {"regeneron"}: an article mentioning
    "regeneron" is almost certainly on-topic, while one mentioning only
    "pharmaceuticals" is almost certainly category noise. Topic focuses made of
    common words ("south asian security") return an empty set, signalling that
    every token carries equal topical weight.
    """
    if zipf_frequency is None:
        return set()
    return {
        tok for tok in _normalize_focus_tokens(focus)
        if zipf_frequency(tok, "en") < _GENERIC_ZIPF
    }


def keyword_hit(text: str, keywords: list[str]) -> bool:
    """True if any keyword appears in text as a whole word or phrase.

    Word-boundary matching, not substring: the alias "cop" must not match
    "Copenhagen", "south" must not match "Southampton". Alias lists carry
    plural forms explicitly (tariff/tariffs, migrant/migrants), so no
    stemming is attempted here.
    """
    if not keywords:
        return False
    haystack = text.lower()
    return any(
        re.search(rf"\b{re.escape(kw.lower())}\b", haystack) is not None
        for kw in keywords
    )


def build_boolean_query(focus: str, *, max_terms: int = 6) -> str:
    """Build a compact OR query string for upstream search APIs.

    The normalized focus phrase always occupies the first slot: alias expansion
    is sorted longest-first, so without this pinning the focus term itself gets
    crowded out of the max_terms window for aliased topics like "trade".

    Multi-word focuses do NOT get their generic tokens OR'd individually:
    querying ("regeneron pharmaceuticals" OR "pharmaceuticals") fills the
    per-source article cap with category noise that crowds out the entity
    itself. Only the phrase, distinctive entity tokens, and known topic
    aliases go upstream.
    """
    tokens = _normalize_focus_tokens(focus)
    phrase = " ".join(tokens)

    if len(tokens) <= 1:
        expanded = [t for t in extract_focus_terms(focus) if t != phrase]
    else:
        anchors = distinctive_tokens(focus)
        expanded = [t for t in tokens if t in anchors]
        for token in tokens:
            for alias in _TERM_ALIASES.get(token, []):
                if alias != phrase and alias not in expanded:
                    expanded.append(alias)

    terms = (([phrase] if phrase else []) + expanded)[:max_terms]
    if not terms:
        return focus.strip()
    if len(terms) == 1:
        return f'"{terms[0]}"'
    return "(" + " OR ".join(f'"{term}"' for term in terms) + ")"
