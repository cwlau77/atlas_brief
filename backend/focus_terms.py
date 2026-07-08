"""Shared helpers for broadening focus phrases into practical search/filter terms."""

from __future__ import annotations

import re

try:
    from wordfreq import zipf_frequency
except ImportError:  # pragma: no cover — dependency is pinned, but degrade gracefully
    zipf_frequency = None

# Zipf frequency BELOW which a token is rare enough to trust as a standalone
# entity anchor (safe to match on its own, without the rest of the phrase).
# Deliberately conservative: general-English rarity is not the same as
# domain-specific ambiguity. "streamer" (zipf 3.0) is uncommon in everyday
# English but ubiquitous *within* entertainment journalism — matching on it
# alone let in every article about any streamer, not the specific focus. Only
# near-unique proper nouns like "regeneron" (1.7) or "openai" (1.6) clear this
# bar; jargon words like "streamer", "tesla", "nvidia" correctly do not, and
# fall back to requiring the full phrase (see build_boolean_query, relevance.py).
_GENERIC_ZIPF = 2.3

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
    """Focus tokens rare enough to trust as standalone entity anchors.

    "Regeneron Pharmaceuticals" → {"regeneron"}: an article mentioning
    "regeneron" alone is almost certainly on-topic. "Streamer University" →
    set(): "streamer" is common jargon within entertainment coverage, so an
    article mentioning it alone is NOT reliably about this specific focus —
    callers must fall back to requiring the full phrase or semantic similarity.
    """
    if zipf_frequency is None:
        return set()
    return {
        tok for tok in _normalize_focus_tokens(focus)
        if zipf_frequency(tok, "en") < _GENERIC_ZIPF
    }


def topic_heads(focus: str) -> set[str]:
    """Focus tokens that are curated broad-topic anchors (see _TERM_ALIASES).

    Unlike distinctive_tokens, this is a manually vetted allowlist: for these
    specific words, matching on the bare token alone (or any of its aliases)
    is intentional and desired — "security" should match "military",
    "ceasefire", "sanctions", etc. independently, not just the literal phrase.
    """
    return {tok for tok in _normalize_focus_tokens(focus) if tok in _TERM_ALIASES}


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
