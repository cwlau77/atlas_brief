"""Turn a free-text focus into a SearchPlan: search strings, required concepts,
an optional coverage-country filter and topic domains.

rule_plan is deterministic and always available; plan_search (below, Task 2)
layers an LLM planner on top and falls back to rule_plan on any failure.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

from backend.focus_terms import _TERM_ALIASES, _normalize_focus_tokens, distinctive_tokens, topic_heads

Domain = Literal["finance", "tech", "politics", "general"]


class SearchPlan(BaseModel):
    phrase: str
    queries: list[str] = Field(default_factory=list)
    must_terms: list[str] = Field(default_factory=list)
    synonyms: list[str] = Field(default_factory=list)
    country: str | None = None
    domains: list[Domain] = Field(default_factory=lambda: ["general"])
    tickers: list[str] = Field(default_factory=list)
    source: Literal["llm", "rules"] = "rules"

    @property
    def match_terms(self) -> list[str]:
        """must_terms + synonyms, lower-cased and deduplicated, longest first."""
        seen: set[str] = set()
        out: list[str] = []
        for term in [*self.must_terms, *self.synonyms]:
            key = " ".join(term.lower().split())
            if key and key not in seen:
                seen.add(key)
                out.append(key)
        return sorted(out, key=lambda t: (-len(t), t))

    @property
    def is_finance(self) -> bool:
        return "finance" in self.domains or bool(self.tickers)


# Place qualifiers that mean "domestic coverage of this country". Only US and
# UK are extracted by rules (see plan Global Constraints ruling); "US" and
# "UK" count only in capitals so the pronoun "us" never matches.
_PLACE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(?:in|across|within|throughout)\s+the\s+(?:us|u\.s\.a?\.?|usa)(?![a-z])", re.I), "US"),
    (re.compile(r"(?<![A-Za-z])(?:U\.S\.A?\.?|USA|US)(?![A-Za-z])"), "US"),
    (re.compile(r"\b(?:(?:in|across|within|throughout)\s+)?(?:the\s+)?united\s+states\b", re.I), "US"),
    (re.compile(r"\b(?:in|across|within|throughout)\s+the\s+(?:uk|u\.k\.)(?![a-z])", re.I), "GB"),
    (re.compile(r"(?<![A-Za-z])(?:U\.K\.|UK)(?![A-Za-z])"), "GB"),
    (re.compile(r"\b(?:(?:in|across|within|throughout)\s+)?(?:the\s+)?(?:united\s+kingdom|britain)\b", re.I), "GB"),
]

_TICKER = re.compile(r"\$([A-Z]{1,5}(?:\.[A-Z]{1,2})?)\b")

_FINANCE_CUES = (
    "stock", "stocks", "shares", "share price", "market", "markets", "earnings", "ipo",
    "bond", "bonds", "yield", "yields", "fed", "federal reserve", "interest rate",
    "interest rates", "inflation", "recession", "crypto", "bitcoin", "etf", "merger",
    "acquisition", "dividend", "wall street", "s&p", "nasdaq", "dow",
)


def _strip_places(text: str) -> tuple[str, str | None]:
    country: str | None = None
    for pattern, code in _PLACE_PATTERNS:
        if pattern.search(text):
            country = country or code
            text = pattern.sub(" ", text)
    return " ".join(text.split()), country


def _plural_variant(term: str) -> str:
    head, _, last = term.rpartition(" ")
    alt = last[:-1] if last.endswith("s") and not last.endswith("ss") else f"{last}s"
    return f"{head} {alt}".strip()


def _domains(text: str, tickers: list[str]) -> list[Domain]:
    low = text.lower()
    if tickers or any(re.search(rf"(?<![a-z]){re.escape(cue)}(?![a-z])", low) for cue in _FINANCE_CUES):
        return ["finance"]
    return ["general"]


def rule_plan(focus: str) -> SearchPlan:
    tickers = list(dict.fromkeys(_TICKER.findall(focus)))[:5]
    text = _TICKER.sub(" ", focus)
    text, country = _strip_places(text)
    tokens = _normalize_focus_tokens(text)
    if not tokens and tickers:
        tokens = [t.lower() for t in tickers]
    if not tokens:
        # Only stopwords/places were typed ("news in the US"): fall back to the
        # raw words so the plan is never empty.
        tokens = [w for w in re.findall(r"[a-z0-9]+", text.lower())] or [focus.strip().lower() or "news"]
    phrase = " ".join(tokens)

    heads = topic_heads(text)
    anchors = distinctive_tokens(text)
    synonyms: list[str] = []

    if len(tokens) == 1:
        token = tokens[0]
        queries = [token]
        must = [token]
        synonyms = [a for a in _TERM_ALIASES.get(token, []) if a != token]
    elif heads:
        queries = [f'"{phrase}"', phrase]
        must = sorted(heads)
        synonyms = [a for h in sorted(heads) for a in _TERM_ALIASES[h] if a not in heads]
    elif anchors:
        ordered = [t for t in tokens if t in anchors]
        queries = [f'"{phrase}"', *ordered[:2]]
        must = ordered
    elif len(tokens) == 2:
        queries = [phrase]
        must = list(tokens)
    else:
        pair = " ".join(tokens[:2])
        rest = " ".join(tokens[2:])
        variant = _plural_variant(pair)
        queries = [f'"{pair}" {rest}', f'"{variant}" {rest}']
        must = [pair, variant, *tokens[2:]]

    return SearchPlan(
        phrase=phrase,
        queries=list(dict.fromkeys(queries))[:3],
        must_terms=list(dict.fromkeys(must))[:4],
        synonyms=list(dict.fromkeys(synonyms))[:8],
        country=country,
        domains=_domains(focus, tickers),
        tickers=tickers,
        source="rules",
    )
