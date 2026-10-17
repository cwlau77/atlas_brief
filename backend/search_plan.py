"""Turn a free-text focus into a SearchPlan: search strings, required concepts,
an optional coverage-country filter and topic domains.

rule_plan is deterministic and always available; plan_search (below, Task 2)
layers an LLM planner on top and falls back to rule_plan on any failure.
"""

from __future__ import annotations

import logging
import re
from typing import Literal

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field

from backend.config import settings
from backend.focus_terms import _TERM_ALIASES, _normalize_focus_tokens, distinctive_tokens, topic_heads
from backend.synthesis.briefing import extract_json

logger = logging.getLogger("briefing.search_plan")

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
#
# The bare capital forms ("US", "UK", with no periods) are ambiguous with
# compounds ("US-China", "US Steel", "US Open"): a trailing "-" or letter
# means it's part of a larger token, not a standalone qualifier, and even
# with nothing trailing it's only a coverage qualifier in qualifier position
# (after in/across/within/throughout/for, optionally "the", or at the very
# end of the focus) -- never as a free-floating word next to another word
# ("US Steel"). The dotted/expanded forms (U.S., USA, United States) are
# unambiguous and stay unrestricted.
_PLACE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(?:in|across|within|throughout)\s+the\s+(?:us|u\.s\.a?\.?|usa)(?![a-z-])", re.I), "US"),
    (re.compile(r"(?<![A-Za-z])(?:U\.S\.A?\.?|USA)(?![A-Za-z-])"), "US"),
    (re.compile(r"\b(?:in|across|within|throughout|for)\s+(?:the\s+)?US(?![A-Za-z-])"), "US"),
    (re.compile(r"(?<![A-Za-z])US(?![A-Za-z-])\s*$"), "US"),
    (re.compile(r"\b(?:(?:in|across|within|throughout)\s+)?(?:the\s+)?united\s+states\b", re.I), "US"),
    (re.compile(r"\b(?:in|across|throughout)\s+America\b", re.I), "US"),
    (re.compile(r"\b(?:in|across|within|throughout)\s+the\s+(?:uk|u\.k\.)(?![a-z-])", re.I), "GB"),
    (re.compile(r"(?<![A-Za-z])U\.K\.(?![A-Za-z-])"), "GB"),
    (re.compile(r"\b(?:in|across|within|throughout|for)\s+(?:the\s+)?UK(?![A-Za-z-])"), "GB"),
    (re.compile(r"(?<![A-Za-z])UK(?![A-Za-z-])\s*$"), "GB"),
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
    # Strip stray leading/trailing hyphens left over from place-stripping
    # (e.g. "US-China" -> " -China" once "US" is removed): a query term
    # starting with "-" is an EXCLUDE operator upstream, so it must never
    # survive into queries/must_terms.
    tokens = [t for t in (tok.strip("-") for tok in _normalize_focus_tokens(text)) if t]
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


PLAN_SYSTEM_PROMPT = """You turn a news-briefing focus into a search plan for news search APIs.
Return ONLY a JSON object with exactly these keys:
- "queries": 1-3 short keyword search strings, most specific first. Put double quotes only around multi-word names that must stay together. No boolean operators.
- "must_terms": 1-4 lowercase concepts that a relevant article must mention, in the words journalists use.
- "synonyms": up to 8 lowercase alternative terms journalists use for the same concepts.
- "country": an ISO 3166-1 alpha-2 code only if the focus limits coverage to one country's domestic news (for example "in the US" -> "US"); otherwise null. A country that is the subject of the story (for example "elections in Iran") is not a filter, so use null.
- "domains": one or more of "finance", "tech", "politics", "general".
- "tickers": uppercase stock ticker symbols only for publicly listed companies named in the focus; otherwise []."""

_DOMAINS = {"finance", "tech", "politics", "general"}
_TICKER_OK = re.compile(r"^[A-Z]{1,5}(?:\.[A-Z]{1,2})?$")
_COUNTRY_OK = re.compile(r"^[A-Za-z]{2}$")


def _str_list(value: object, limit: int, *, lower: bool = False) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        text = " ".join(item.split())[:80]
        if lower:
            text = text.lower()
        if text and text not in out:
            out.append(text)
        if len(out) >= limit:
            break
    return out


def _plural_variants(must_terms: list[str]) -> list[str]:
    """Plural/singular counterpart of each must-term's last word, so a plan with
    must-term "data center" still matches text saying "data centers" --
    keyword_hit is whole-word, not stemmed. Skip short last words (<= 3
    chars): pluralizing jargon like "ai", "eu", "ipo" produces noise, not
    a useful variant."""
    variants: list[str] = []
    for term in must_terms:
        last = term.rpartition(" ")[2]
        if len(last) <= 3:
            continue
        variant = _plural_variant(term)
        if variant != term:
            variants.append(variant)
    return variants


def _clamp(data: dict, fallback: SearchPlan) -> SearchPlan:
    queries = _str_list(data.get("queries"), 3)
    if not queries:
        raise ValueError("search plan has no queries")
    raw_country = data.get("country")
    country = raw_country.strip().upper() if isinstance(raw_country, str) and _COUNTRY_OK.match(raw_country.strip()) else None
    domains = [d for d in _str_list(data.get("domains"), 4, lower=True) if d in _DOMAINS] or ["general"]
    llm_tickers = [t.upper() for t in _str_list(data.get("tickers"), 5) if _TICKER_OK.match(t.upper())]
    must_terms = _str_list(data.get("must_terms"), 4, lower=True) or fallback.must_terms
    synonyms = _str_list(data.get("synonyms"), 8, lower=True)
    synonyms = list(dict.fromkeys([*synonyms, *_plural_variants(must_terms)]))[:8]
    return SearchPlan(
        phrase=fallback.phrase,
        queries=queries,
        must_terms=must_terms,
        synonyms=synonyms,
        country=country or fallback.country,
        domains=domains,
        tickers=list(dict.fromkeys([*fallback.tickers, *llm_tickers]))[:5],
        source="llm",
    )


async def _llm_plan(focus: str, fallback: SearchPlan) -> SearchPlan:
    client = AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.search_plan_timeout_seconds,
        max_retries=0,
    )
    response = await client.messages.create(
        model=settings.search_plan_model,
        max_tokens=512,
        system=PLAN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Focus: {focus}"}],
    )
    raw = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
    return _clamp(extract_json(raw), fallback)


async def plan_search(focus: str) -> SearchPlan:
    """LLM search plan when available, otherwise (or on any failure) the rule plan."""
    fallback = rule_plan(focus)
    if not (settings.search_plan_enabled and settings.anthropic_api_key):
        return fallback
    try:
        return await _llm_plan(focus, fallback)
    except Exception as exc:  # timeout, API error, invalid JSON, validation: all degrade to rules
        logger.warning("search plan LLM failed for focus=%r (%s); using rule plan", focus, type(exc).__name__)
        return fallback
