# Broaden Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make major topics (e.g. "Data centers and privacy in the US") return full, relevant briefings by planning searches (LLM with rule fallback), fanning out to 13 free sources, deduplicating, and reranking with Haiku.

**Architecture:** `plan_search(focus)` produces a `SearchPlan`; `ingestion/registry.ingest(plan)` runs every enabled source module (uniform `fetch(plan, client)` contract) in parallel under per-source timeouts and an overall deadline, guarded by per-source daily quotas; `processing/urls.dedupe_exact` and the existing embedding dedupe collapse duplicates; `processing/rerank.rank_articles` pre-filters to ≤ 60 candidates and asks Haiku to keep the best ≤ 25, falling back to the existing keyword + TF-IDF filter. Synthesis is unchanged.

**Tech Stack:** Python 3.11, FastAPI, httpx 0.27.2, feedparser 6.0.11, anthropic 0.40.0 (pinned), pydantic v2 / pydantic-settings, numpy, pytest 8 + pytest-asyncio + respx. Frontend: React/TS (one label change).

**Spec:** `docs/superpowers/specs/2026-10-17-broaden-retrieval-design.md`

## Global Constraints

- Branch `retrieval/broaden`. Commit at the end of every task. Every commit message ends with a blank line and exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new Python dependencies. Use httpx, feedparser, anthropic 0.40.0, numpy as already pinned in `backend/requirements.txt`.
- LLM calls: `AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=<seconds>, max_retries=0)`, `client.messages.create(...)`, prompt-instructed JSON parsed with `backend.synthesis.briefing.extract_json`, models from settings (default `"claude-haiku-4-5"`). Do not use `output_config`, `messages.parse`, or structured-output betas (not in SDK 0.40.0).
- `Article.raw_source_type` values are exactly: `newsapi`, `gdelt`, `rss`, `google_news`, `guardian`, `gnews`, `newsdata`, `brave`, `tavily`, `exa`, `finnhub`, `marketaux`, `alphavantage`.
- A source module never raises out of `fetch`; on any failure it returns `[]` and logs `source=<name> status=<reason>` (reasons: `network_error`, `rate_limited`, `http_<code>`, `malformed`, `api_error`, `quota_exhausted`). API keys are never logged and are sent in headers wherever the API supports it.
- Default timeouts: `SOURCE_TIMEOUT_SECONDS=8`, `INGEST_DEADLINE_SECONDS=15`, search plan 4 s, rerank 8 s. Rerank caps: `RERANK_MAX_CANDIDATES=60`, `RERANK_KEEP=25`, keep score ≥ 2.
- Default daily quotas: newsapi 90, gnews 90, newsdata 180, guardian 4500, brave 30, tavily 30, exa 40, google_news 300, finnhub 1000, marketaux 90, alphavantage 20. GDELT and RSS are unlimited (GDELT keeps its existing 5.5 s pacer).
- Finance-only sources (finnhub, marketaux, alphavantage) run only when `plan.is_finance` (domains contain `"finance"` or tickers present).
- **Controller ruling (spec §3.1 conflict):** the rule planner extracts a country filter only for US (`US`) and the UK (`GB`). "EU"/"European Union" and other country names stay as content terms (they are usually the story's subject, and "EU" is not an ISO alpha-2 code). The LLM planner may set any ISO code per its prompt.
- **Controller ruling (spec §3.5):** dedupe keeps the earliest copy; per-article outlet lists are not stored (no consumer exists); the count of merged duplicates is logged instead.
- Python environment: the repo's `.venv` is iCloud-evicted. Create and use an external venv:
  ```bash
  python3 -m venv ~/.venvs/atlasbrief
  ~/.venvs/atlasbrief/bin/pip install -r "/Users/camlau/Desktop/cs/personal/Atlas Brief/backend/requirements-dev.txt"
  ```
  Run tests from the repo root: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && ~/.venvs/atlasbrief/bin/python -m pytest -q` (pytest.ini sets `testpaths = backend/tests`). A single file: `... -m pytest backend/tests/test_x.py -q`.

## Review Focus

1. **A source returns HTTP 200 with an error body** (Alpha Vantage `{"Information": "...limit..."}` or `{"Note": ...}`, NewsData `{"status": "error", ...}`): treated as empty with `status=api_error`, never a crash. Pinned in Task 6 (NewsData) and Task 8 (Alpha Vantage).
2. **Articles with missing, naive, or odd-format dates:** normalized to UTC-aware or `None`, and ranking handles `None` dates. Pinned in Task 3 (`parse_datetime`) and Task 10 (prefilter with a `None` date).
3. **A focus made only of stopwords/place words** ("news in the US"): the plan still has a non-empty phrase and queries, and the pipeline does not crash. Pinned in Task 1.
4. **A long or non-ASCII focus** (≈200 chars, accents): NewsData query truncated to its 100-char limit, no crash. Pinned in Task 6.
5. **Every source skipped or empty** (no keys and keyless sources down): the 502 message names the sources skipped for missing keys. Pinned in Task 4.

---

## File Structure

```
backend/
  config.py                          (modify: new settings per task)
  models.py                          (modify: SourceType literal)
  focus_terms.py                     (modify: "us" stopword; remove build_boolean_query in Task 4)
  search_plan.py                     (create: SearchPlan, rule_plan, plan_search)
  main.py                            (modify: plan → ingest → dedupe → rank pipeline, log line)
  ingestion/
    __init__.py                      (modify: export registry API)
    common.py                        (create: parse_datetime, get_json, post_json, clean_text, outlet_from_url, lookback_start, matches_plan, USER_AGENT)
    quota.py                         (create: QuotaGuard, quota singleton)
    query_format.py                  (create: and_query, or_of_ands, best_query)
    registry.py                      (create: Source, SourceStat, IngestResult, SOURCES, ingest)
    newsapi_source.py, gdelt_source.py, rss_source.py   (modify: plan contract)
    google_news_source.py, guardian_source.py, gnews_source.py, newsdata_source.py,
    brave_source.py, tavily_source.py, exa_source.py,
    finnhub_source.py, marketaux_source.py, alphavantage_source.py   (create)
  processing/
    urls.py                          (create: normalize_url, normalize_title, dedupe_exact)
    rerank.py                        (create: prefilter, rerank, rank_articles, RankResult)
  tests/
    test_search_plan.py, test_ingestion_common.py, test_registry.py,
    test_google_news.py, test_general_sources.py, test_search_sources.py,
    test_finance_sources.py, test_urls.py, test_rerank.py   (create)
    fixtures/broad_topics.py         (create)
    test_newsapi.py, test_gdelt.py, test_rss.py, test_focus_terms.py, test_api.py   (modify)
  .env.example, README.md            (modify)
render.yaml                          (modify)
frontend/src/lib/signals.ts (+ signals.test.ts)   (modify)
```

---

### Task 1: SearchPlan model and rule planner

**Files:**
- Create: `backend/search_plan.py`
- Modify: `backend/focus_terms.py` (add `"us"` to `_STOPWORDS`)
- Test: `backend/tests/test_search_plan.py`, `backend/tests/test_focus_terms.py`

**Interfaces:**
- Consumes: `focus_terms._TERM_ALIASES`, `_normalize_focus_tokens(focus) -> list[str]`, `distinctive_tokens(focus) -> set[str]`, `topic_heads(focus) -> set[str]`, `extract_focus_terms`.
- Produces:
  - `class SearchPlan(BaseModel)`: `phrase: str`, `queries: list[str]`, `must_terms: list[str]`, `synonyms: list[str]`, `country: str | None`, `domains: list[Literal["finance","tech","politics","general"]]`, `tickers: list[str]`, `source: Literal["llm","rules"]`; properties `match_terms -> list[str]` (must_terms + synonyms, lower-cased, deduped, longest first) and `is_finance -> bool`.
  - `rule_plan(focus: str) -> SearchPlan`

- [ ] **Step 1: Set up the Python environment** (see Global Constraints) and confirm the existing suite runs:

Run: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && ~/.venvs/atlasbrief/bin/python -m pytest -q`
Expected: all existing tests pass.

- [ ] **Step 2: Write the failing tests** `backend/tests/test_search_plan.py`

```python
from backend.search_plan import SearchPlan, rule_plan


def test_data_centers_example_splits_place_pair_and_drops_pronoun():
    plan = rule_plan("Data centers and privacy in the US")
    assert plan.source == "rules"
    assert plan.phrase == "data centers privacy"
    assert plan.country == "US"
    assert plan.queries[0] == '"data centers" privacy'
    assert '"data center" privacy' in plan.queries
    assert {"data centers", "data center", "privacy"} <= set(plan.must_terms)
    every_term = " ".join(plan.queries + plan.must_terms + plan.synonyms)
    assert " us" not in f" {every_term}"
    assert plan.domains == ["general"]


def test_lowercase_in_the_us_is_a_place():
    assert rule_plan("student loans in the us").country == "US"


def test_us_with_periods_and_united_states():
    plan = rule_plan("U.S. chip export rules")
    assert plan.country == "US"
    assert plan.phrase == "chip export rules"
    wildfire = rule_plan("wildfire insurance across the United States")
    assert wildfire.country == "US"
    assert wildfire.phrase == "wildfire insurance"


def test_pronoun_us_is_not_a_place():
    plan = rule_plan("what the tariffs mean for us")
    assert plan.country is None
    assert "us" not in plan.phrase.split()


def test_uk_maps_to_gb_and_eu_stays_a_content_term():
    assert rule_plan("housing costs in the UK").country == "GB"
    eu = rule_plan("EU trade rules")
    assert eu.country is None
    assert "eu" in eu.phrase.split()


def test_entity_focus_keeps_anchor_behavior():
    plan = rule_plan("Regeneron Pharmaceuticals")
    assert plan.queries[0] == '"regeneron pharmaceuticals"'
    assert plan.must_terms == ["regeneron"]


def test_single_word_topic_keeps_aliases():
    plan = rule_plan("climate")
    assert plan.queries == ["climate"]
    assert plan.must_terms == ["climate"]
    assert "net zero" in plan.synonyms


def test_topic_head_focus_uses_head_and_aliases():
    plan = rule_plan("South Asian security")
    assert plan.must_terms == ["security"]
    assert "military" in plan.synonyms
    assert plan.queries[0] == '"south asian security"'


def test_two_word_focus_requires_both_terms_without_exact_phrase():
    plan = rule_plan("lithium mining")
    assert plan.queries == ["lithium mining"]
    assert plan.must_terms == ["lithium", "mining"]


def test_finance_cues_and_tickers():
    assert rule_plan("Nvidia earnings and AI chip stocks").domains == ["finance"]
    plan = rule_plan("$NVDA guidance")
    assert plan.tickers == ["NVDA"]
    assert plan.is_finance
    assert plan.phrase == "guidance"
    assert rule_plan("data centers and privacy in the US").is_finance is False


def test_ticker_only_focus_has_a_phrase():
    plan = rule_plan("$NVDA")
    assert plan.phrase == "nvda"
    assert plan.queries == ["nvda"]


def test_place_only_focus_still_produces_a_plan():
    plan = rule_plan("news in the US")
    assert plan.phrase
    assert plan.queries
    assert plan.country == "US"


def test_match_terms_dedupes_and_orders_longest_first():
    plan = SearchPlan(phrase="x", queries=["x"], must_terms=["privacy", "Data Centers"],
                      synonyms=["privacy", "data broker"])
    assert plan.match_terms == ["data centers", "data broker", "privacy"]
```

Append to `backend/tests/test_focus_terms.py`:

```python
def test_pronoun_us_is_a_stopword():
    assert "us" not in extract_focus_terms("Data centers and privacy in the US")
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_search_plan.py backend/tests/test_focus_terms.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.search_plan'`, and the stopword test fails.

- [ ] **Step 4: Add `"us"` to `_STOPWORDS` in `backend/focus_terms.py`**

In the `_STOPWORDS` set literal, add `"us",` after `"amid",`.

- [ ] **Step 5: Write `backend/search_plan.py`**

```python
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_search_plan.py backend/tests/test_focus_terms.py -q`
Expected: PASS. Then the full suite: `~/.venvs/atlasbrief/bin/python -m pytest -q` — all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/search_plan.py backend/focus_terms.py backend/tests/test_search_plan.py backend/tests/test_focus_terms.py
git commit -m "feat(retrieval): SearchPlan model and rule-based planner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: LLM search planner (`plan_search`)

**Files:**
- Modify: `backend/search_plan.py`, `backend/config.py`
- Test: `backend/tests/test_search_plan.py`

**Interfaces:**
- Consumes: Task 1 `SearchPlan`, `rule_plan`; `backend.synthesis.briefing.extract_json(raw: str) -> dict` (raises `ValueError`).
- Produces: `async def plan_search(focus: str) -> SearchPlan`; settings `search_plan_enabled: bool = True`, `search_plan_model: str = "claude-haiku-4-5"`, `search_plan_timeout_seconds: float = 4.0`.

- [ ] **Step 1: Write the failing tests** (append to `backend/tests/test_search_plan.py`)

```python
import json
from types import SimpleNamespace

import pytest

import backend.search_plan as search_plan
from backend.config import settings
from backend.search_plan import plan_search


class _FakeAnthropic:
    """Stands in for AsyncAnthropic; records calls and returns a canned reply or raises."""
    reply: str | Exception = ""
    calls: list[dict] = []

    def __init__(self, **kwargs):
        self.init_kwargs = kwargs
        self.messages = self

    async def create(self, **kwargs):
        _FakeAnthropic.calls.append(kwargs)
        if isinstance(_FakeAnthropic.reply, Exception):
            raise _FakeAnthropic.reply
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=_FakeAnthropic.reply)])


@pytest.fixture
def fake_llm(monkeypatch):
    _FakeAnthropic.calls = []
    monkeypatch.setattr(search_plan, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "search_plan_enabled", True)
    return _FakeAnthropic


@pytest.mark.asyncio
async def test_llm_plan_is_parsed_and_clamped(fake_llm):
    fake_llm.reply = json.dumps({
        "queries": ["q1", "q2", "q3", "q4", "q5"],
        "must_terms": ["Data Center", "privacy"],
        "synonyms": ["hyperscale", "data broker"],
        "country": "us",
        "domains": ["tech", "sports"],
        "tickers": ["msft", "TOOLONGX"],
    })
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.source == "llm"
    assert plan.queries == ["q1", "q2", "q3"]
    assert plan.must_terms == ["data center", "privacy"]
    assert plan.country == "US"
    assert plan.domains == ["tech"]
    assert plan.tickers == ["MSFT"]
    assert plan.phrase == "data centers privacy"  # phrase always comes from the rule plan
    assert fake_llm.calls[0]["model"] == settings.search_plan_model


@pytest.mark.asyncio
async def test_llm_null_country_keeps_rule_country(fake_llm):
    fake_llm.reply = json.dumps({"queries": ["data center privacy"], "must_terms": ["privacy"],
                                 "synonyms": [], "country": None, "domains": ["general"], "tickers": []})
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.country == "US"


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["not json at all", json.dumps({"queries": []}), TimeoutError("slow")])
async def test_llm_failures_fall_back_to_rules(fake_llm, reply):
    fake_llm.reply = reply
    plan = await plan_search("Data centers and privacy in the US")
    assert plan.source == "rules"
    assert plan.queries[0] == '"data centers" privacy'


@pytest.mark.asyncio
async def test_no_key_or_disabled_uses_rules_without_calling_llm(fake_llm, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    assert (await plan_search("climate")).source == "rules"
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "search_plan_enabled", False)
    assert (await plan_search("climate")).source == "rules"
    assert fake_llm.calls == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_search_plan.py -q`
Expected: FAIL — `ImportError: cannot import name 'plan_search'`.

- [ ] **Step 3: Add settings** to `backend/config.py` (inside `Settings`, after `context_enrichment_limit`)

```python
    # Search planning (LLM turns the focus into queries; rules are the fallback).
    search_plan_enabled: bool = True
    search_plan_model: str = "claude-haiku-4-5"
    search_plan_timeout_seconds: float = 4.0
```

- [ ] **Step 4: Implement the LLM planner** — append to `backend/search_plan.py` (and add the imports at the top of the file)

Top-of-file imports to add:

```python
import logging

from anthropic import AsyncAnthropic

from backend.config import settings
from backend.synthesis.briefing import extract_json

logger = logging.getLogger("briefing.search_plan")
```

Append:

```python
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


def _clamp(data: dict, fallback: SearchPlan) -> SearchPlan:
    queries = _str_list(data.get("queries"), 3)
    if not queries:
        raise ValueError("search plan has no queries")
    raw_country = data.get("country")
    country = raw_country.strip().upper() if isinstance(raw_country, str) and _COUNTRY_OK.match(raw_country.strip()) else None
    domains = [d for d in _str_list(data.get("domains"), 4, lower=True) if d in _DOMAINS] or ["general"]
    llm_tickers = [t.upper() for t in _str_list(data.get("tickers"), 5) if _TICKER_OK.match(t.upper())]
    return SearchPlan(
        phrase=fallback.phrase,
        queries=queries,
        must_terms=_str_list(data.get("must_terms"), 4, lower=True) or fallback.must_terms,
        synonyms=_str_list(data.get("synonyms"), 8, lower=True),
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_search_plan.py -q` → PASS. Full suite → all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/search_plan.py backend/config.py backend/tests/test_search_plan.py
git commit -m "feat(retrieval): Haiku search planner with rule fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ingestion helpers, query formatting, quota guard

**Files:**
- Create: `backend/ingestion/common.py`, `backend/ingestion/query_format.py`, `backend/ingestion/quota.py`
- Modify: `backend/config.py`
- Test: `backend/tests/test_ingestion_common.py`

**Interfaces:**
- Consumes: Task 1 `SearchPlan`; `focus_terms.keyword_hit(text, keywords) -> bool`.
- Produces:
  - `common.USER_AGENT: str`
  - `common.parse_datetime(value) -> datetime | None` (UTC-aware)
  - `async common.get_json(client, url, *, source, params=None, headers=None) -> Any | None`
  - `async common.post_json(client, url, *, source, json_body, headers=None) -> Any | None`
  - `common.clean_text(value, limit=1000) -> str`, `common.outlet_from_url(url) -> str`, `common.lookback_start(hours=None) -> datetime`, `common.matches_plan(text, plan) -> bool`
  - `query_format.query_terms(q) -> list[str]`, `and_query(q) -> str`, `or_of_ands(queries) -> str`, `best_query(plan) -> str`
  - `quota.QuotaGuard(today=...)` with `.take(source, n=1) -> bool`; module singleton `quota.quota`
  - settings `source_timeout_seconds: float = 8.0`, `ingest_deadline_seconds: float = 15.0`, `quota_<name>_per_day: int` for each limited source

- [ ] **Step 1: Write the failing tests** `backend/tests/test_ingestion_common.py`

```python
from datetime import date, datetime, timezone

import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion.common import (
    clean_text, get_json, matches_plan, outlet_from_url, parse_datetime, post_json,
)
from backend.ingestion.query_format import and_query, best_query, or_of_ands, query_terms
from backend.ingestion.quota import QuotaGuard
from backend.search_plan import SearchPlan


@pytest.mark.parametrize("value,expected", [
    ("2026-10-16T14:30:00Z", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("2026-10-16T14:30:00+02:00", datetime(2026, 10, 16, 12, 30, tzinfo=timezone.utc)),
    ("2026-10-16 14:30:00", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("Fri, 16 Oct 2026 14:30:00 GMT", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("20261016T143000Z", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    ("20261016T143000", datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
    (1792161000, datetime(2026, 10, 16, 14, 30, tzinfo=timezone.utc)),
])
def test_parse_datetime_formats_are_utc_aware(value, expected):
    parsed = parse_datetime(value)
    assert parsed == expected
    assert parsed.tzinfo is not None


@pytest.mark.parametrize("value", [None, "", "yesterday", {}, "2026-13-45"])
def test_parse_datetime_bad_input_is_none(value):
    assert parse_datetime(value) is None


def test_clean_text_strips_html_and_whitespace():
    assert clean_text("<p>Data  <b>centers</b></p>\n grow") == "Data centers grow"
    assert clean_text(None) == ""
    assert len(clean_text("x" * 5000)) == 1000


def test_outlet_from_url():
    assert outlet_from_url("https://www.reuters.com/tech/x") == "reuters.com"
    assert outlet_from_url("not a url") == ""


def test_matches_plan_uses_match_terms():
    plan = SearchPlan(phrase="data centers privacy", queries=["x"], must_terms=["data centers", "privacy"])
    assert matches_plan("New privacy rules for apps", plan)
    assert not matches_plan("US jobs data beat forecasts", plan)


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("response,expected", [
    (httpx.Response(200, json={"ok": 1}), {"ok": 1}),
    (httpx.Response(429), None),
    (httpx.Response(500), None),
    (httpx.Response(200, text="<html>not json"), None),
])
async def test_get_json_handles_errors(response, expected):
    respx.get("https://api.example.com/x").mock(return_value=response)
    async with httpx.AsyncClient() as client:
        assert await get_json(client, "https://api.example.com/x", source="test") == expected


@pytest.mark.asyncio
@respx.mock
async def test_get_and_post_json_network_error_is_none():
    respx.get("https://api.example.com/x").mock(side_effect=httpx.ConnectError("down"))
    respx.post("https://api.example.com/y").mock(side_effect=httpx.ReadTimeout("slow"))
    async with httpx.AsyncClient() as client:
        assert await get_json(client, "https://api.example.com/x", source="test") is None
        assert await post_json(client, "https://api.example.com/y", source="test", json_body={}) is None


def test_query_formatting():
    assert query_terms('"data centers" privacy') == ['"data centers"', "privacy"]
    assert and_query('"data centers" privacy') == '"data centers" AND privacy'
    assert or_of_ands(['"data centers" privacy', "hyperscale"]) == '("data centers" AND privacy) OR (hyperscale)'
    assert or_of_ands(["climate"]) == "climate"
    assert best_query(SearchPlan(phrase="p", queries=[])) == "p"
    assert best_query(SearchPlan(phrase="p", queries=["q1", "q2"])) == "q1"


def test_quota_guard_budget_and_daily_reset(monkeypatch):
    monkeypatch.setattr(settings, "quota_tavily_per_day", 2, raising=False)
    day = {"d": date(2026, 10, 17)}
    guard = QuotaGuard(today=lambda: day["d"])
    assert guard.take("tavily") and guard.take("tavily")
    assert guard.take("tavily") is False
    day["d"] = date(2026, 10, 18)
    assert guard.take("tavily") is True


def test_quota_guard_unlimited_source_and_multi_take(monkeypatch):
    monkeypatch.setattr(settings, "quota_guardian_per_day", 3, raising=False)
    guard = QuotaGuard(today=lambda: date(2026, 10, 17))
    assert all(guard.take("gdelt") for _ in range(100))
    assert guard.take("guardian", n=2) is True
    assert guard.take("guardian", n=2) is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_ingestion_common.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.ingestion.common'`.

- [ ] **Step 3: Add settings** to `backend/config.py` (inside `Settings`)

```python
    # Fan-out timing.
    source_timeout_seconds: float = 8.0
    ingest_deadline_seconds: float = 15.0

    # Per-source daily request budgets (UTC day, in-process). Unlisted sources are unlimited.
    quota_newsapi_per_day: int = 90
    quota_gnews_per_day: int = 90
    quota_newsdata_per_day: int = 180
    quota_guardian_per_day: int = 4500
    quota_brave_per_day: int = 30
    quota_tavily_per_day: int = 30
    quota_exa_per_day: int = 40
    quota_google_news_per_day: int = 300
    quota_finnhub_per_day: int = 1000
    quota_marketaux_per_day: int = 90
    quota_alphavantage_per_day: int = 20
```

- [ ] **Step 4: Write `backend/ingestion/common.py`**

```python
"""Shared helpers for source modules: tolerant HTTP JSON calls that never raise,
date parsing to UTC, text cleanup, and plan keyword matching."""

from __future__ import annotations

import email.utils
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

from backend.config import settings
from backend.focus_terms import keyword_hit
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.ingestion")

USER_AGENT = "AtlasBrief/1.0 (+https://github.com/cwlau77/atlas_brief)"

_TAG = re.compile(r"<[^>]+>")
_COMPACT_FORMATS = ("%Y%m%dT%H%M%SZ", "%Y%m%dT%H%M%S")


def parse_datetime(value: Any) -> datetime | None:
    """Parse ISO-8601, RFC-822, compact GDELT/Alpha Vantage, or epoch seconds into UTC."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    for fmt in _COMPACT_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = email.utils.parsedate_to_datetime(text)
        except (TypeError, ValueError, IndexError):
            return None
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def clean_text(value: Any, limit: int = 1000) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(_TAG.sub(" ", value).split())[:limit]


def outlet_from_url(url: str) -> str:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""
    return host[4:] if host.startswith("www.") else host


def lookback_start(hours: float | None = None) -> datetime:
    window = settings.hours_lookback if hours is None else hours
    return datetime.now(timezone.utc) - timedelta(hours=max(window, 1))


def matches_plan(text: str, plan: SearchPlan) -> bool:
    return keyword_hit(text, plan.match_terms)


def _decode(resp: httpx.Response, source: str) -> Any | None:
    if resp.status_code == 429:
        logger.warning("source=%s status=rate_limited", source)
        return None
    if resp.status_code >= 400:
        logger.warning("source=%s status=http_%d", source, resp.status_code)
        return None
    try:
        return resp.json()
    except ValueError:
        logger.warning("source=%s status=malformed", source)
        return None


async def get_json(client: httpx.AsyncClient, url: str, *, source: str,
                   params: dict | None = None, headers: dict | None = None) -> Any | None:
    try:
        resp = await client.get(url, params=params, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)


async def post_json(client: httpx.AsyncClient, url: str, *, source: str,
                    json_body: dict, headers: dict | None = None) -> Any | None:
    try:
        resp = await client.post(url, json=json_body, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("source=%s status=network_error detail=%s", source, type(exc).__name__)
        return None
    return _decode(resp, source)
```

- [ ] **Step 5: Write `backend/ingestion/query_format.py`**

```python
"""Format SearchPlan queries for upstream APIs."""

from __future__ import annotations

import re

from backend.search_plan import SearchPlan

_TERM = re.compile(r'"[^"]+"|\S+')


def query_terms(query: str) -> list[str]:
    """Split a plan query into quoted phrases and bare words."""
    return _TERM.findall(query)


def and_query(query: str) -> str:
    """'"data centers" privacy' -> '"data centers" AND privacy' (NewsAPI/Guardian syntax)."""
    return " AND ".join(query_terms(query))


def or_of_ands(queries: list[str]) -> str:
    parts = [and_query(q) for q in queries if q.strip()]
    if len(parts) == 1:
        return parts[0]
    return " OR ".join(f"({p})" for p in parts)


def best_query(plan: SearchPlan) -> str:
    return plan.queries[0] if plan.queries else plan.phrase
```

- [ ] **Step 6: Write `backend/ingestion/quota.py`**

```python
"""In-process daily request budgets per source (UTC day). Resets on restart,
which is acceptable at personal/portfolio traffic."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Callable

from backend.config import settings

logger = logging.getLogger("briefing.quota")


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


class QuotaGuard:
    def __init__(self, today: Callable[[], date] = _utc_today) -> None:
        self._today = today
        self._day: date | None = None
        self._used: dict[str, int] = {}
        self._warned: set[str] = set()

    def take(self, source: str, n: int = 1) -> bool:
        """Reserve n requests for source today; False (and log once) when the budget is spent."""
        day = self._today()
        if day != self._day:
            self._day, self._used, self._warned = day, {}, set()
        budget = getattr(settings, f"quota_{source}_per_day", None)
        if budget is None:
            return True
        used = self._used.get(source, 0)
        if used + n > budget:
            if source not in self._warned:
                logger.warning("source=%s status=quota_exhausted budget=%d", source, budget)
                self._warned.add(source)
            return False
        self._used[source] = used + n
        return True


quota = QuotaGuard()
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_ingestion_common.py -q` → PASS. Full suite → all pass.

- [ ] **Step 8: Commit**

```bash
git add backend/ingestion/common.py backend/ingestion/query_format.py backend/ingestion/quota.py backend/config.py backend/tests/test_ingestion_common.py
git commit -m "feat(retrieval): ingestion helpers, query formatting and daily quota guard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Plan-driven ingestion registry; migrate NewsAPI, GDELT, RSS; wire into the API

**Files:**
- Create: `backend/ingestion/registry.py`, `backend/tests/test_registry.py`
- Modify: `backend/models.py`, `backend/ingestion/newsapi_source.py`, `backend/ingestion/gdelt_source.py`, `backend/ingestion/rss_source.py`, `backend/ingestion/__init__.py`, `backend/focus_terms.py` (remove `build_boolean_query`), `backend/main.py`
- Test: `backend/tests/test_newsapi.py`, `backend/tests/test_gdelt.py`, `backend/tests/test_rss.py`, `backend/tests/test_focus_terms.py`, `backend/tests/test_api.py`

**Interfaces:**
- Consumes: Task 2 `plan_search`, Task 1 `SearchPlan`/`rule_plan`, Task 3 helpers, `quota.quota`.
- Produces:
  - `models.SourceType` literal (the 13 names in Global Constraints); `Article.raw_source_type: SourceType`
  - Every source module: `SOURCE_NAME: str`, `FINANCE_ONLY: bool`, `enabled() -> bool`, `async fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]`
  - `registry.Source(name, fetch, enabled, finance_only)`, `registry.SourceStat(count: int, status: str, ms: int)`, `registry.IngestResult(articles: list[Article], stats: dict[str, SourceStat], skipped_missing_key: list[str])`, `registry.SOURCES: list[Source]`, `registry.source_from_module(module) -> Source`, `async registry.ingest(plan, sources=None) -> IngestResult`
  - `main._ingest_all(plan: SearchPlan) -> IngestResult`

- [ ] **Step 1: Widen the source literal** in `backend/models.py`

Replace the `raw_source_type` line of `Article` and add the alias above the class:

```python
SourceType = Literal[
    "newsapi", "gdelt", "rss", "google_news", "guardian", "gnews", "newsdata",
    "brave", "tavily", "exa", "finnhub", "marketaux", "alphavantage",
]
```

```python
    raw_source_type: SourceType
```

- [ ] **Step 2: Write the failing registry tests** `backend/tests/test_registry.py`

```python
import asyncio

import pytest

from backend.config import settings
from backend.ingestion.registry import Source, ingest
from backend.search_plan import SearchPlan, rule_plan


def _source(name, articles=None, *, delay=0.0, raises=None, enabled=True, finance_only=False):
    async def fetch(plan, client):
        if delay:
            await asyncio.sleep(delay)
        if raises:
            raise raises
        return list(articles or [])
    return Source(name=name, fetch=fetch, enabled=lambda: enabled, finance_only=finance_only)


@pytest.mark.asyncio
async def test_ingest_merges_in_source_order_and_records_stats(make_article):
    a, b = make_article(title="A"), make_article(title="B")
    result = await ingest(rule_plan("climate"), [_source("rss", [a]), _source("gdelt", [b]), _source("brave", [])])
    assert result.articles == [a, b]
    assert result.stats["rss"].count == 1 and result.stats["rss"].status == "ok"
    assert result.stats["brave"].status == "empty"


@pytest.mark.asyncio
async def test_slow_and_raising_sources_do_not_block_others(make_article, monkeypatch):
    monkeypatch.setattr(settings, "source_timeout_seconds", 0.05)
    ok = make_article(title="fine")
    result = await ingest(rule_plan("climate"), [
        _source("rss", [ok]),
        _source("gdelt", [make_article()], delay=1.0),
        _source("brave", raises=RuntimeError("boom")),
    ])
    assert result.articles == [ok]
    assert result.stats["gdelt"].status == "timeout"
    assert result.stats["brave"].status == "error"


@pytest.mark.asyncio
async def test_overall_deadline_cancels_stragglers(make_article, monkeypatch):
    monkeypatch.setattr(settings, "source_timeout_seconds", 5.0)
    monkeypatch.setattr(settings, "ingest_deadline_seconds", 0.05)
    result = await ingest(rule_plan("climate"), [_source("gdelt", [make_article()], delay=1.0)])
    assert result.articles == []
    assert result.stats["gdelt"].status == "deadline"


@pytest.mark.asyncio
async def test_disabled_sources_are_reported_and_finance_sources_gated(make_article):
    general = rule_plan("data centers and privacy in the US")
    sources = [_source("guardian", enabled=False), _source("finnhub", [make_article()], finance_only=True)]
    result = await ingest(general, sources)
    assert result.skipped_missing_key == ["guardian"]
    assert "finnhub" not in result.stats

    finance = SearchPlan(phrase="nvda", queries=["nvda"], domains=["finance"])
    result = await ingest(finance, sources)
    assert result.stats["finnhub"].count == 1
```

- [ ] **Step 3: Update the existing source tests** to the plan contract

Replace `backend/tests/test_newsapi.py` with:

```python
import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import newsapi_source
from backend.ingestion.newsapi_source import NEWSAPI_EVERYTHING, fetch
from backend.search_plan import SearchPlan

PAYLOAD = {"totalResults": 1, "articles": [
    {"title": "Tariff talks stall", "description": "Negotiations pause.",
     "url": "https://ex.com/t", "source": {"name": "ExWire"},
     "publishedAt": "2026-07-06T09:00:00Z"}]}

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale"])


@pytest.mark.asyncio
@respx.mock
async def test_key_sent_as_header_and_queries_ored(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", "sekrit")
    route = respx.get(NEWSAPI_EVERYTHING).mock(return_value=httpx.Response(200, json=PAYLOAD))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert len(articles) == 1 and articles[0].raw_source_type == "newsapi"
    assert articles[0].published_at.tzinfo is not None
    req = route.calls[0].request
    assert req.headers.get("X-Api-Key") == "sekrit"
    assert "sekrit" not in str(req.url)
    assert req.url.params["q"] == '("data centers" AND privacy) OR (hyperscale)'


@pytest.mark.asyncio
async def test_missing_key_disables_source(monkeypatch):
    monkeypatch.setattr(settings, "newsapi_key", None)
    assert newsapi_source.enabled() is False
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []
```

In `backend/tests/test_gdelt.py`: change the import line to `from backend.ingestion.gdelt_source import GDELT_DOC_API, fetch`, add `from backend.search_plan import SearchPlan` and `PLAN = SearchPlan(phrase="border clash", queries=["border clash"])`, and replace every `await fetch_gdelt("<focus>")` call with:

```python
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
```

(adjusting the variable name each test uses for the result). Then append:

```python
@pytest.mark.asyncio
@respx.mock
async def test_gdelt_uses_best_query_country_filter_and_drops_short_terms():
    route = respx.get(GDELT_DOC_API).mock(return_value=httpx.Response(200, json=GDELT_PAYLOAD))
    plan = SearchPlan(phrase="ai data centers", queries=['ai "data centers"'], country="GB")
    async with httpx.AsyncClient() as client:
        await fetch(plan, client)
    query = route.calls[0].request.url.params["query"]
    assert '"data centers"' in query
    assert "sourcecountry:UK" in query
    assert " ai " not in f" {query} "  # GDELT rejects terms shorter than 3 characters
```

In `backend/tests/test_rss.py`: keep the four existing tests and append:

```python
def test_feed_list_covers_us_tech_and_finance_desks():
    outlets = {name for name, _ in RSS_FEEDS}
    assert len(outlets & {"NPR News", "New York Times U.S.", "New York Times Technology",
                          "Washington Post Technology", "Axios", "Politico", "The Verge",
                          "Ars Technica", "Wired"}) >= 6
    assert len(outlets & {"MarketWatch", "CNBC Top News", "Yahoo Finance",
                          "Investing.com", "Financial Times"}) >= 3
```

In `backend/tests/test_focus_terms.py`: delete the four tests that exercise `build_boolean_query` (`test_boolean_query_quotes_and_ors`, `test_boolean_query_always_includes_the_focus_phrase_itself`, `test_entity_query_drops_generic_bare_tokens_upstream`, `test_multiword_topic_query_keeps_phrase_and_aliases_not_bare_tokens`) and remove `build_boolean_query` from the import line. Their intent is now covered by `test_search_plan.py` (entity anchors, topic aliases, focus phrase in queries).

In `backend/tests/test_api.py`: replace the `fake_ingest` definition inside the `client` fixture with:

```python
    async def fake_ingest(plan):
        return IngestResult(
            articles=[make_article(title=f"{plan.phrase} development one",
                                   snippet=f"Latest on {plan.phrase}.", url="https://ex.com/dev1")],
            stats={},
            skipped_missing_key=[],
        )
```

add `from backend.ingestion.registry import IngestResult` to the imports, and append:

```python
def test_502_names_sources_skipped_for_missing_keys(client, monkeypatch):
    async def empty_ingest(plan):
        return IngestResult(articles=[], stats={}, skipped_missing_key=["guardian", "tavily"])
    monkeypatch.setattr(main, "_ingest_all", empty_ingest)
    r = client.post("/briefing", json={"focus": "trade policy"})
    assert r.status_code == 502
    assert "guardian" in r.json()["detail"] and "tavily" in r.json()["detail"]
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests -q`
Expected: FAIL — missing `backend.ingestion.registry`, `fetch` names, and the new feed/API assertions.

- [ ] **Step 5: Rewrite `backend/ingestion/newsapi_source.py`**

```python
import logging

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, parse_datetime
from backend.ingestion.query_format import or_of_ands
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.newsapi")

SOURCE_NAME = "newsapi"
FINANCE_ONLY = False
NEWSAPI_EVERYTHING = "https://newsapi.org/v2/everything"


def enabled() -> bool:
    return bool(settings.newsapi_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NewsAPI /everything with the plan's queries OR'd together (free tier delays 24 h)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        "q": or_of_ands(plan.queries or [plan.phrase]),
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": settings.max_articles_per_source,
    }
    # Key in a header so it never appears in logged URLs.
    payload = await get_json(client, NEWSAPI_EVERYTHING, source=SOURCE_NAME, params=params,
                             headers={"X-Api-Key": settings.newsapi_key})
    if not isinstance(payload, dict):
        return []
    articles: list[Article] = []
    for item in payload.get("articles") or []:
        title, url = item.get("title") or "", item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description") or item.get("content")) or title,
            url=url,
            source=(item.get("source") or {}).get("name") or "NewsAPI",
            published_at=parse_datetime(item.get("publishedAt")),
            country=None,
            raw_source_type="newsapi",
        ))
    logger.info("source=%s count=%d totalResults=%s", SOURCE_NAME, len(articles), payload.get("totalResults"))
    return articles
```

- [ ] **Step 6: Update `backend/ingestion/gdelt_source.py`**

Replace the imports of `build_boolean_query` with `from backend.ingestion.common import parse_datetime` and `from backend.ingestion.query_format import best_query, query_terms` and `from backend.search_plan import SearchPlan`. Add module constants and helpers, and replace `fetch_gdelt` with `fetch` (keep `_pace`, `_GDELT_RETRY_DELAY_SECONDS`, `_pace_lock`, `_last_request_at` unchanged):

```python
SOURCE_NAME = "gdelt"
FINANCE_ONLY = False

# GDELT sourcecountry takes FIPS codes; only the ones the planner commonly emits are mapped.
_FIPS = {"US": "US", "GB": "UK"}


def enabled() -> bool:
    return True


def _gdelt_query(plan: SearchPlan) -> str:
    # GDELT rejects bare terms shorter than 3 characters ("ai"); quoted phrases are fine.
    terms = [t for t in query_terms(best_query(plan)) if t.startswith('"') or len(t) >= 3]
    query = " ".join(terms) or plan.phrase
    fips = _FIPS.get(plan.country or "")
    if fips:
        query = f"{query} sourcecountry:{fips}"
    return f"{query} sourcelang:english"


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """GDELT DOC 2.0 ArtList for the plan's best query (paced, one retry on 429)."""
    params = {
        "query": _gdelt_query(plan),
        "mode": "ArtList",
        "maxrecords": settings.max_articles_per_source,
        "format": "json",
        "timespan": f"{max(settings.hours_lookback, 1)}h",
        "sort": "DateDesc",
    }
    payload = None
    try:
        for attempt in (1, 2):
            try:
                await _pace()
                resp = await client.get(GDELT_DOC_API, params=params)
                resp.raise_for_status()
                payload = resp.json()
                break
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429 and attempt == 1:
                    backoff = _GDELT_RETRY_DELAY_SECONDS + random.random()
                    logger.info("source=gdelt status=rate_limited retry_in=%.1fs", backoff)
                    await asyncio.sleep(backoff)
                    continue
                logger.warning("source=gdelt status=http_%d", exc.response.status_code)
                return []
    except Exception as exc:
        logger.warning("source=gdelt status=network_error detail=%s", type(exc).__name__)
        return []
    if not isinstance(payload, dict):
        return []
    articles: list[Article] = []
    for item in payload.get("articles") or []:
        title, url = item.get("title") or "", item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title, snippet=title, url=url,
            source=item.get("domain") or "GDELT",
            published_at=parse_datetime(item.get("seendate")),
            country=item.get("sourcecountry") or None,
            raw_source_type="gdelt",
        ))
    return articles
```

Delete the now-unused `datetime`/`timezone`/`Optional` imports if nothing else uses them.

- [ ] **Step 7: Update `backend/ingestion/rss_source.py`**

1. Replace `from backend.focus_terms import extract_focus_terms, keyword_hit` with `from backend.focus_terms import keyword_hit` and add `from backend.search_plan import SearchPlan`.
2. Append these entries to `RSS_FEEDS` (after the CBS entry):

```python
    # US national, tech and policy desks (domestic coverage the world desks miss).
    ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ("New York Times U.S.", "https://rss.nytimes.com/services/xml/rss/nyt/US.xml"),
    ("New York Times Technology", "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"),
    ("Washington Post Technology", "https://feeds.washingtonpost.com/rss/business/technology"),
    ("Axios", "https://api.axios.com/feed/"),
    ("Politico", "https://rss.politico.com/politics-news.xml"),
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
    ("Wired", "https://www.wired.com/feed/rss"),
    # Finance desks.
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories"),
    ("CNBC Top News", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    ("Investing.com", "https://www.investing.com/rss/news.rss"),
    ("Financial Times", "https://www.ft.com/rss/home"),
```

3. Add the module contract and replace `fetch_rss` with `fetch` (keep `_entry_to_article`, `_parse_feed`, `_fetch_feed_text`):

```python
SOURCE_NAME = "rss"
FINANCE_ONLY = False


def enabled() -> bool:
    return True


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Curated feeds fetched concurrently on the shared client, keyword-filtered by the plan."""
    keywords = plan.match_terms
    contents = await asyncio.gather(*(_fetch_feed_text(client, outlet, url) for outlet, url in RSS_FEEDS))
    tasks = [
        asyncio.to_thread(_parse_feed, outlet, content, keywords)
        for (outlet, _), content in zip(RSS_FEEDS, contents)
        if content
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    articles: list[Article] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning("source=rss status=malformed detail=%s", type(result).__name__)
            continue
        articles.extend(result)
    logger.info("source=rss feeds=%d count=%d", sum(1 for c in contents if c), len(articles))
    return articles
```

Remove `_FEED_TIMEOUT_SECONDS` and `_FEED_USER_AGENT` (the shared client in the registry sets timeout and User-Agent).

4. **Verify the new feed URLs** with the shared User-Agent; drop any that do not return HTTP 200 with RSS/Atom content, and list dropped ones in your report:

```bash
for u in https://feeds.npr.org/1001/rss.xml https://rss.nytimes.com/services/xml/rss/nyt/US.xml https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml https://feeds.washingtonpost.com/rss/business/technology https://api.axios.com/feed/ https://rss.politico.com/politics-news.xml https://www.theverge.com/rss/index.xml https://feeds.arstechnica.com/arstechnica/index https://www.wired.com/feed/rss https://feeds.marketwatch.com/marketwatch/topstories "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" https://finance.yahoo.com/news/rssindex https://www.investing.com/rss/news.rss https://www.ft.com/rss/home; do printf "%s %s\n" "$(curl -s -o /tmp/feed.xml -w '%{http_code}' -A 'AtlasBrief/1.0 (+https://github.com/cwlau77/atlas_brief)' -L --max-time 10 "$u")" "$(grep -c -m1 -E '<rss|<feed|<rdf' /tmp/feed.xml) $u"; done
```

Expected: `200 1 <url>` for each kept feed. If a feed is dropped, keep the test's thresholds satisfiable (≥ 6 US/tech, ≥ 3 finance); if that is impossible, report DONE_WITH_CONCERNS with the curl output.

- [ ] **Step 8: Write `backend/ingestion/registry.py`**

```python
"""Run every enabled source for a SearchPlan in parallel under per-source
timeouts and an overall deadline. A failing source never fails the briefing."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from types import ModuleType
from typing import Awaitable, Callable

import httpx

from backend.config import settings
from backend.ingestion import gdelt_source, newsapi_source, rss_source
from backend.ingestion.common import USER_AGENT
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.registry")


@dataclass(frozen=True)
class Source:
    name: str
    fetch: Callable[[SearchPlan, httpx.AsyncClient], Awaitable[list[Article]]]
    enabled: Callable[[], bool]
    finance_only: bool = False


@dataclass
class SourceStat:
    count: int
    status: str
    ms: int


@dataclass
class IngestResult:
    articles: list[Article]
    stats: dict[str, SourceStat]
    skipped_missing_key: list[str]


def source_from_module(module: ModuleType) -> Source:
    return Source(
        name=module.SOURCE_NAME,
        fetch=module.fetch,
        enabled=module.enabled,
        finance_only=getattr(module, "FINANCE_ONLY", False),
    )


SOURCES: list[Source] = [source_from_module(m) for m in (newsapi_source, gdelt_source, rss_source)]


async def _run(source: Source, plan: SearchPlan, client: httpx.AsyncClient) -> tuple[list[Article], SourceStat]:
    start = time.monotonic()
    try:
        articles = await asyncio.wait_for(source.fetch(plan, client), timeout=settings.source_timeout_seconds)
        status = "ok" if articles else "empty"
    except asyncio.TimeoutError:
        articles, status = [], "timeout"
        logger.warning("source=%s status=timeout", source.name)
    except Exception as exc:  # a source bug must not fail the briefing
        articles, status = [], "error"
        logger.warning("source=%s status=error detail=%s", source.name, type(exc).__name__)
    return articles, SourceStat(len(articles), status, int((time.monotonic() - start) * 1000))


async def ingest(plan: SearchPlan, sources: list[Source] | None = None) -> IngestResult:
    sources = SOURCES if sources is None else sources
    active: list[Source] = []
    skipped: list[str] = []
    for source in sources:
        if source.finance_only and not plan.is_finance:
            continue
        if not source.enabled():
            skipped.append(source.name)
            continue
        active.append(source)

    stats: dict[str, SourceStat] = {}
    by_source: dict[str, list[Article]] = {}
    async with httpx.AsyncClient(
        timeout=settings.source_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        tasks = {asyncio.create_task(_run(s, plan, client)): s for s in active}
        if tasks:
            done, pending = await asyncio.wait(tasks, timeout=settings.ingest_deadline_seconds)
            for task in pending:
                task.cancel()
                name = tasks[task].name
                stats[name] = SourceStat(0, "deadline", int(settings.ingest_deadline_seconds * 1000))
                logger.warning("source=%s status=deadline", name)
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                articles, stat = task.result()
                name = tasks[task].name
                stats[name] = stat
                by_source[name] = articles

    merged = [a for s in active for a in by_source.get(s.name, [])]
    return IngestResult(articles=merged, stats=stats, skipped_missing_key=skipped)
```

- [ ] **Step 9: Update `backend/ingestion/__init__.py`**

```python
from .registry import SOURCES, IngestResult, Source, SourceStat, ingest

__all__ = ["SOURCES", "IngestResult", "Source", "SourceStat", "ingest"]
```

- [ ] **Step 10: Remove `build_boolean_query`** from `backend/focus_terms.py` (delete the whole function; nothing imports it after this task). Confirm: `grep -rn build_boolean_query backend` returns nothing.

- [ ] **Step 11: Wire the plan and registry into `backend/main.py`**

Replace the imports `from backend.ingestion import fetch_gdelt, fetch_newsapi, fetch_rss` with:

```python
from backend.ingestion import IngestResult, ingest
from backend.search_plan import SearchPlan, plan_search
```

Replace `_ingest_all` with:

```python
async def _ingest_all(plan: SearchPlan) -> IngestResult:
    result = await ingest(plan)
    logger.info(
        "ingestion summary phrase=%r plan=%s: %s skipped=%s",
        plan.phrase, plan.source,
        {name: (s.count, s.status, s.ms) for name, s in result.stats.items()},
        result.skipped_missing_key,
    )
    return result
```

In `briefing_endpoint`, replace the block from `# Layer 2: ingest` through the `if not articles:` 502 handling with:

```python
    # Layer 2: plan + ingest (parallel fan-out across all enabled sources)
    plan = await plan_search(focus)
    ingest_result = await _ingest_all(plan)
    articles = ingest_result.articles
    logger.info("ingested %d raw articles for focus=%r", len(articles), focus)
    if not articles:
        skipped = ingest_result.skipped_missing_key
        hint = (
            f" Sources skipped for missing API keys: {', '.join(skipped)}."
            if skipped
            else " All upstream sources returned zero articles — try a broader focus, or retry in a minute in case an upstream rate limit is in effect."
        )
        raise HTTPException(status_code=502, detail=f"No articles could be fetched from any source.{hint}")
```

Leave the rest of the endpoint unchanged for now (Task 9 and Task 10 extend it).

- [ ] **Step 12: Run tests to verify they pass**

Run: `~/.venvs/atlasbrief/bin/python -m pytest -q`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add backend
git commit -m "feat(retrieval): plan-driven ingestion registry; migrate NewsAPI, GDELT, RSS; US/tech/finance feeds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Google News RSS search source

**Files:**
- Create: `backend/ingestion/google_news_source.py`, `backend/tests/test_google_news.py`
- Modify: `backend/ingestion/registry.py` (register)

**Interfaces:**
- Consumes: Task 3 `parse_datetime`, `clean_text`, `quota`; Task 4 `source_from_module`, `SOURCES`.
- Produces: `google_news_source` module (`SOURCE_NAME="google_news"`, `FINANCE_ONLY=False`, `GOOGLE_NEWS_SEARCH`, `enabled()`, `fetch(plan, client)`).

- [ ] **Step 1: Write the failing tests** `backend/tests/test_google_news.py`

```python
import httpx
import pytest
import respx

from backend.ingestion import google_news_source
from backend.ingestion.google_news_source import GOOGLE_NEWS_SEARCH, fetch
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

FEED = """<?xml version="1.0"?><rss version="2.0"><channel><title>Google News</title>
<item><title>States push data center privacy rules - Reuters</title>
<link>https://news.google.com/rss/articles/abc</link>
<pubDate>Fri, 16 Oct 2026 14:30:00 GMT</pubDate>
<description>&lt;a href="x"&gt;States push data center privacy rules&lt;/a&gt;</description>
<source url="https://www.reuters.com">Reuters</source></item>
</channel></rss>"""

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale privacy"], country="US")


@pytest.mark.asyncio
@respx.mock
async def test_parses_items_and_strips_outlet_suffix():
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        articles = await fetch(PLAN, client)
    assert route.call_count == 2  # one request per plan query
    a = articles[0]
    assert a.title == "States push data center privacy rules"
    assert a.source == "Reuters"
    assert a.raw_source_type == "google_news"
    assert a.published_at.isoformat() == "2026-10-16T14:30:00+00:00"
    params = route.calls[0].request.url.params
    assert params["gl"] == "US" and params["ceid"] == "US:en"
    assert params["q"].endswith("when:7d")


@pytest.mark.asyncio
@respx.mock
async def test_country_defaults_to_us_and_gb_is_used():
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        await fetch(SearchPlan(phrase="housing", queries=["housing"], country="GB"), client)
        await fetch(SearchPlan(phrase="housing", queries=["housing"]), client)
    assert route.calls[0].request.url.params["gl"] == "GB"
    assert route.calls[1].request.url.params["hl"] == "en-US"


@pytest.mark.asyncio
@respx.mock
async def test_http_error_returns_empty():
    respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(503))
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []


@pytest.mark.asyncio
@respx.mock
async def test_quota_exhausted_skips_requests(monkeypatch):
    monkeypatch.setattr(google_news_source.quota, "take", lambda source, n=1: False)
    route = respx.get(GOOGLE_NEWS_SEARCH).mock(return_value=httpx.Response(200, text=FEED))
    async with httpx.AsyncClient() as client:
        assert await fetch(PLAN, client) == []
    assert route.call_count == 0


def test_registered():
    assert "google_news" in {s.name for s in SOURCES}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_google_news.py -q` → FAIL (module missing).

- [ ] **Step 3: Write `backend/ingestion/google_news_source.py`**

```python
"""Google News RSS search: free, query-based, strong US coverage. Unofficial,
so treated as best effort with a polite User-Agent (set on the shared client)."""

import asyncio
import logging
from datetime import datetime, timezone
from time import mktime

import feedparser
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.google_news")

SOURCE_NAME = "google_news"
FINANCE_ONLY = False
GOOGLE_NEWS_SEARCH = "https://news.google.com/rss/search"


def enabled() -> bool:
    return True


def _parse(text: str) -> list[Article]:
    parsed = feedparser.parse(text)
    articles: list[Article] = []
    for entry in parsed.entries[: settings.max_articles_per_source]:
        title = getattr(entry, "title", "") or ""
        link = getattr(entry, "link", "") or ""
        if not title or not link:
            continue
        outlet = ((getattr(entry, "source", None) or {}).get("title") or "").strip()
        suffix = f" - {outlet}"
        if outlet and title.endswith(suffix):
            title = title[: -len(suffix)]
        published_at = None
        struct_time = getattr(entry, "published_parsed", None)
        if struct_time:
            try:
                published_at = datetime.fromtimestamp(mktime(struct_time), tz=timezone.utc)
            except (OverflowError, ValueError):
                published_at = None
        articles.append(Article(
            title=title,
            snippet=clean_text(getattr(entry, "summary", "")) or title,
            url=link,
            source=outlet or "Google News",
            published_at=published_at,
            country=None,
            raw_source_type="google_news",
        ))
    return articles


async def _search(client: httpx.AsyncClient, query: str, cc: str) -> str:
    params = {"q": f"{query} when:7d", "hl": f"en-{cc}", "gl": cc, "ceid": f"{cc}:en"}
    try:
        resp = await client.get(GOOGLE_NEWS_SEARCH, params=params)
    except httpx.HTTPError as exc:
        logger.warning("source=google_news status=network_error detail=%s", type(exc).__name__)
        return ""
    if resp.status_code >= 400:
        logger.warning("source=google_news status=http_%d", resp.status_code)
        return ""
    return resp.text


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    cc = (plan.country or "US").upper()
    queries = [q for q in (plan.queries or [plan.phrase])[:3] if quota.take(SOURCE_NAME)]
    texts = await asyncio.gather(*(_search(client, q, cc) for q in queries))
    articles: list[Article] = []
    for text in texts:
        if text:
            articles.extend(await asyncio.to_thread(_parse, text))
    return articles
```

Note on the `when:7d` operator: it limits results to the past week. Note that the quota check consumes budget per query.

- [ ] **Step 4: Register the source** in `backend/ingestion/registry.py`: add `google_news_source` to the `from backend.ingestion import ...` line and to the tuple in `SOURCES` (after `rss_source`).

- [ ] **Step 5: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/ingestion/google_news_source.py backend/ingestion/registry.py backend/tests/test_google_news.py
git commit -m "feat(retrieval): Google News RSS search source

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Guardian, GNews and NewsData sources

**Files:**
- Create: `backend/ingestion/guardian_source.py`, `backend/ingestion/gnews_source.py`, `backend/ingestion/newsdata_source.py`, `backend/tests/test_general_sources.py`
- Modify: `backend/config.py`, `backend/ingestion/registry.py`

**Interfaces:**
- Consumes: Task 3 helpers (`get_json`, `parse_datetime`, `clean_text`, `lookback_start`, `and_query`, `best_query`, `quota`); Task 4 registry.
- Produces: three modules with the source contract; settings `guardian_api_key`, `gnews_api_key`, `newsdata_api_key` (all `Optional[str] = None`).

- [ ] **Step 1: Add settings** to `backend/config.py` (after `huggingface_api_key`)

```python
    guardian_api_key: Optional[str] = None
    gnews_api_key: Optional[str] = None
    newsdata_api_key: Optional[str] = None
```

- [ ] **Step 2: Write the failing tests** `backend/tests/test_general_sources.py`

```python
import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import gnews_source, guardian_source, newsdata_source
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy', "hyperscale privacy"], country="US")

GUARDIAN = {"response": {"status": "ok", "results": [
    {"webTitle": "Data centre boom raises privacy fears", "webUrl": "https://www.theguardian.com/a",
     "webPublicationDate": "2026-10-16T09:00:00Z", "fields": {"trailText": "<p>Local opposition grows</p>"}}]}}
GNEWS = {"articles": [
    {"title": "Data centers face privacy scrutiny", "description": "Regulators act.",
     "url": "https://ex.com/g", "publishedAt": "2026-10-16T10:00:00Z", "source": {"name": "ExWire"}}]}
NEWSDATA = {"status": "success", "results": [
    {"title": "Privacy rules for data centers", "description": "New bill.", "link": "https://ex.com/n",
     "pubDate": "2026-10-16 11:00:00", "source_name": "Example News"}]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "guardian_api_key", "g-key")
    monkeypatch.setattr(settings, "gnews_api_key", "gn-key")
    monkeypatch.setattr(settings, "newsdata_api_key", "nd-key")


@pytest.mark.asyncio
@respx.mock
async def test_guardian_maps_results_and_sends_two_queries(keys):
    route = respx.get(guardian_source.GUARDIAN_SEARCH).mock(return_value=httpx.Response(200, json=GUARDIAN))
    async with httpx.AsyncClient() as client:
        articles = await guardian_source.fetch(PLAN, client)
    assert route.call_count == 2
    a = articles[0]
    assert (a.title, a.source, a.raw_source_type) == ("Data centre boom raises privacy fears", "The Guardian", "guardian")
    assert a.snippet == "Local opposition grows"
    assert a.published_at.tzinfo is not None
    params = route.calls[0].request.url.params
    assert params["q"] == '"data centers" AND privacy'
    assert params["order-by"] == "newest" and params["show-fields"] == "trailText"


@pytest.mark.asyncio
@respx.mock
async def test_gnews_maps_results_with_country(keys):
    route = respx.get(gnews_source.GNEWS_SEARCH).mock(return_value=httpx.Response(200, json=GNEWS))
    async with httpx.AsyncClient() as client:
        articles = await gnews_source.fetch(PLAN, client)
    assert articles[0].source == "ExWire" and articles[0].raw_source_type == "gnews"
    params = route.calls[0].request.url.params
    assert params["country"] == "us" and params["lang"] == "en"


@pytest.mark.asyncio
@respx.mock
async def test_newsdata_maps_results_and_truncates_long_query(keys):
    route = respx.get(newsdata_source.NEWSDATA_LATEST).mock(return_value=httpx.Response(200, json=NEWSDATA))
    long_plan = SearchPlan(phrase="x", queries=["é" * 150 + " policy"], country="GB")
    async with httpx.AsyncClient() as client:
        articles = await newsdata_source.fetch(PLAN, client)
        await newsdata_source.fetch(long_plan, client)
    assert articles[0].raw_source_type == "newsdata" and articles[0].source == "Example News"
    assert articles[0].published_at.isoformat() == "2026-10-16T11:00:00+00:00"
    assert len(route.calls[1].request.url.params["q"]) <= 100
    assert route.calls[1].request.url.params["country"] == "gb"


@pytest.mark.asyncio
@respx.mock
async def test_newsdata_error_body_is_empty(keys):
    respx.get(newsdata_source.NEWSDATA_LATEST).mock(
        return_value=httpx.Response(200, json={"status": "error", "results": {"message": "rate limit"}}))
    async with httpx.AsyncClient() as client:
        assert await newsdata_source.fetch(PLAN, client) == []


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("module,url_attr", [
    (guardian_source, "GUARDIAN_SEARCH"), (gnews_source, "GNEWS_SEARCH"), (newsdata_source, "NEWSDATA_LATEST"),
])
async def test_http_errors_and_missing_keys(module, url_attr, keys, monkeypatch):
    respx.get(getattr(module, url_attr)).mock(return_value=httpx.Response(429))
    async with httpx.AsyncClient() as client:
        assert await module.fetch(PLAN, client) == []
    for key in ("guardian_api_key", "gnews_api_key", "newsdata_api_key"):
        monkeypatch.setattr(settings, key, None)
    assert module.enabled() is False


def test_registered():
    assert {"guardian", "gnews", "newsdata"} <= {s.name for s in SOURCES}
```

- [ ] **Step 3: Run tests to verify they fail** — `~/.venvs/atlasbrief/bin/python -m pytest backend/tests/test_general_sources.py -q` → FAIL (modules missing).

- [ ] **Step 4: Write `backend/ingestion/guardian_source.py`**

```python
import asyncio

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, parse_datetime
from backend.ingestion.query_format import and_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "guardian"
FINANCE_ONLY = False
GUARDIAN_SEARCH = "https://content.guardianapis.com/search"


def enabled() -> bool:
    return bool(settings.guardian_api_key)


async def _search(client: httpx.AsyncClient, query: str) -> list[Article]:
    params = {
        "q": and_query(query),
        "api-key": settings.guardian_api_key,  # the Content API only accepts the key as a parameter
        "order-by": "newest",
        "page-size": settings.max_articles_per_source,
        "show-fields": "trailText",
        "from-date": lookback_start().date().isoformat(),
    }
    payload = await get_json(client, GUARDIAN_SEARCH, source=SOURCE_NAME, params=params)
    response = payload.get("response") if isinstance(payload, dict) else None
    results = response.get("results") if isinstance(response, dict) else None
    articles: list[Article] = []
    for item in results or []:
        title, url = item.get("webTitle") or "", item.get("webUrl") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text((item.get("fields") or {}).get("trailText")) or title,
            url=url,
            source="The Guardian",
            published_at=parse_datetime(item.get("webPublicationDate")),
            country="GB",
            raw_source_type="guardian",
        ))
    return articles


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    if not enabled():
        return []
    queries = [q for q in (plan.queries or [plan.phrase])[:2] if quota.take(SOURCE_NAME)]
    batches = await asyncio.gather(*(_search(client, q) for q in queries))
    return [a for batch in batches for a in batch]
```

- [ ] **Step 5: Write `backend/ingestion/gnews_source.py`**

```python
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "gnews"
FINANCE_ONLY = False
GNEWS_SEARCH = "https://gnews.io/api/v4/search"


def enabled() -> bool:
    return bool(settings.gnews_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """GNews free tier: 100 requests/day, 12 h delay, non-commercial use."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        "q": best_query(plan),
        "lang": "en",
        "max": 10,
        "sortby": "publishedAt",
        "from": lookback_start().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "apikey": settings.gnews_api_key,
    }
    if plan.country:
        params["country"] = plan.country.lower()
    payload = await get_json(client, GNEWS_SEARCH, source=SOURCE_NAME, params=params)
    articles: list[Article] = []
    items = payload.get("articles") if isinstance(payload, dict) else None
    for item in items or []:
        title, url = item.get("title") or "", item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=(item.get("source") or {}).get("name") or "GNews",
            published_at=parse_datetime(item.get("publishedAt")),
            country=None,
            raw_source_type="gnews",
        ))
    return articles
```

- [ ] **Step 6: Write `backend/ingestion/newsdata_source.py`**

```python
import logging

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.newsdata")

SOURCE_NAME = "newsdata"
FINANCE_ONLY = False
NEWSDATA_LATEST = "https://newsdata.io/api/1/latest"
_MAX_QUERY_CHARS = 100  # NewsData rejects longer q values


def enabled() -> bool:
    return bool(settings.newsdata_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NewsData.io free tier: 200 credits/day, 10 articles per credit."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"apikey": settings.newsdata_api_key, "q": best_query(plan)[:_MAX_QUERY_CHARS], "language": "en"}
    if plan.country:
        params["country"] = plan.country.lower()
    payload = await get_json(client, NEWSDATA_LATEST, source=SOURCE_NAME, params=params)
    if not isinstance(payload, dict):
        return []
    if payload.get("status") != "success":
        logger.warning("source=newsdata status=api_error")
        return []
    articles: list[Article] = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        title, url = item.get("title") or "", item.get("link") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=item.get("source_name") or item.get("source_id") or "NewsData",
            published_at=parse_datetime(item.get("pubDate")),
            country=None,
            raw_source_type="newsdata",
        ))
    return articles
```

- [ ] **Step 7: Register** `guardian_source`, `gnews_source`, `newsdata_source` in `registry.py` (import line and `SOURCES` tuple, after `google_news_source`).

- [ ] **Step 8: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/ingestion/guardian_source.py backend/ingestion/gnews_source.py backend/ingestion/newsdata_source.py backend/ingestion/registry.py backend/config.py backend/tests/test_general_sources.py
git commit -m "feat(retrieval): Guardian, GNews and NewsData sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Brave, Tavily and Exa sources

**Files:**
- Create: `backend/ingestion/brave_source.py`, `backend/ingestion/tavily_source.py`, `backend/ingestion/exa_source.py`, `backend/tests/test_search_sources.py`
- Modify: `backend/config.py`, `backend/ingestion/registry.py`

**Interfaces:**
- Consumes: Task 3 helpers (`get_json`, `post_json`, `parse_datetime`, `clean_text`, `outlet_from_url`, `lookback_start`, `best_query`, `quota`).
- Produces: three source modules; settings `brave_api_key`, `tavily_api_key`, `exa_api_key` (`Optional[str] = None`).

- [ ] **Step 1: Add settings** to `backend/config.py`

```python
    brave_api_key: Optional[str] = None
    tavily_api_key: Optional[str] = None
    exa_api_key: Optional[str] = None
```

- [ ] **Step 2: Write the failing tests** `backend/tests/test_search_sources.py`

```python
import json

import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import brave_source, exa_source, tavily_source
from backend.ingestion.registry import SOURCES
from backend.search_plan import SearchPlan

PLAN = SearchPlan(phrase="data centers privacy", queries=['"data centers" privacy'], country="US")

BRAVE = {"results": [{"title": "Data center privacy fight", "url": "https://www.example.com/b",
                      "description": "<strong>Data</strong> center story", "page_age": "2026-10-16T08:00:00",
                      "profile": {"name": "Example"}, "meta_url": {"hostname": "www.example.com"}}]}
TAVILY = {"results": [{"title": "Privacy and data centers", "url": "https://news.example.org/t",
                       "content": "Story text", "published_date": "Fri, 16 Oct 2026 12:00:00 GMT"}]}
EXA = {"results": [{"title": "Hyperscale privacy concerns", "url": "https://exa.example.net/e",
                    "publishedDate": "2026-10-15T07:00:00.000Z"}]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "brave_api_key", "b-key")
    monkeypatch.setattr(settings, "tavily_api_key", "t-key")
    monkeypatch.setattr(settings, "exa_api_key", "e-key")


@pytest.mark.asyncio
@respx.mock
async def test_brave_maps_results_and_uses_header_key(keys):
    route = respx.get(brave_source.BRAVE_NEWS).mock(return_value=httpx.Response(200, json=BRAVE))
    async with httpx.AsyncClient() as client:
        articles = await brave_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type, a.snippet) == ("Example", "brave", "Data center story")
    req = route.calls[0].request
    assert req.headers["X-Subscription-Token"] == "b-key"
    assert "b-key" not in str(req.url)
    assert req.url.params["freshness"] == "pw" and req.url.params["country"] == "US"


@pytest.mark.asyncio
@respx.mock
async def test_tavily_posts_news_topic_with_bearer_key(keys):
    route = respx.post(tavily_source.TAVILY_SEARCH).mock(return_value=httpx.Response(200, json=TAVILY))
    async with httpx.AsyncClient() as client:
        articles = await tavily_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type) == ("news.example.org", "tavily")
    assert a.published_at.isoformat() == "2026-10-16T12:00:00+00:00"
    req = route.calls[0].request
    assert req.headers["Authorization"] == "Bearer t-key"
    body = json.loads(req.content)
    assert body["topic"] == "news" and body["days"] == 7 and body["query"] == '"data centers" privacy'


@pytest.mark.asyncio
@respx.mock
async def test_exa_posts_news_category_with_header_key(keys):
    route = respx.post(exa_source.EXA_SEARCH).mock(return_value=httpx.Response(200, json=EXA))
    async with httpx.AsyncClient() as client:
        articles = await exa_source.fetch(PLAN, client)
    a = articles[0]
    assert (a.source, a.raw_source_type, a.snippet) == ("exa.example.net", "exa", a.title)
    req = route.calls[0].request
    assert req.headers["x-api-key"] == "e-key"
    body = json.loads(req.content)
    assert body["category"] == "news" and "startPublishedDate" in body


@pytest.mark.asyncio
@respx.mock
async def test_errors_and_missing_keys(keys, monkeypatch):
    respx.get(brave_source.BRAVE_NEWS).mock(return_value=httpx.Response(500))
    respx.post(tavily_source.TAVILY_SEARCH).mock(return_value=httpx.Response(429))
    respx.post(exa_source.EXA_SEARCH).mock(return_value=httpx.Response(200, text="oops"))
    async with httpx.AsyncClient() as client:
        for module in (brave_source, tavily_source, exa_source):
            assert await module.fetch(PLAN, client) == []
    for key in ("brave_api_key", "tavily_api_key", "exa_api_key"):
        monkeypatch.setattr(settings, key, None)
    assert not any(m.enabled() for m in (brave_source, tavily_source, exa_source))


def test_registered():
    assert {"brave", "tavily", "exa"} <= {s.name for s in SOURCES}
```

- [ ] **Step 3: Run tests to verify they fail** → FAIL (modules missing).

- [ ] **Step 4: Write `backend/ingestion/brave_source.py`**

```python
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, outlet_from_url, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "brave"
FINANCE_ONLY = False
BRAVE_NEWS = "https://api.search.brave.com/res/v1/news/search"


def enabled() -> bool:
    return bool(settings.brave_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Brave News Search (metered: ~$5 monthly credit on new accounts)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"q": best_query(plan), "count": 20, "freshness": "pw", "search_lang": "en"}
    if plan.country:
        params["country"] = plan.country.upper()
    payload = await get_json(client, BRAVE_NEWS, source=SOURCE_NAME, params=params,
                             headers={"X-Subscription-Token": settings.brave_api_key, "Accept": "application/json"})
    items = payload.get("results") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description")) or title,
            url=url,
            source=(item.get("profile") or {}).get("name") or outlet_from_url(url) or "Brave",
            published_at=parse_datetime(item.get("page_age")),
            country=None,
            raw_source_type="brave",
        ))
    return articles
```

- [ ] **Step 5: Write `backend/ingestion/tavily_source.py`**

```python
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, outlet_from_url, parse_datetime, post_json
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "tavily"
FINANCE_ONLY = False
TAVILY_SEARCH = "https://api.tavily.com/search"


def enabled() -> bool:
    return bool(settings.tavily_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Tavily news search (1,000 free credits/month)."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    body = {"query": best_query(plan), "topic": "news", "days": 7, "max_results": 15, "search_depth": "basic"}
    payload = await post_json(client, TAVILY_SEARCH, source=SOURCE_NAME, json_body=body,
                              headers={"Authorization": f"Bearer {settings.tavily_api_key}"})
    items = payload.get("results") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("content")) or title,
            url=url,
            source=outlet_from_url(url) or "Tavily",
            published_at=parse_datetime(item.get("published_date")),
            country=None,
            raw_source_type="tavily",
        ))
    return articles
```

- [ ] **Step 6: Write `backend/ingestion/exa_source.py`**

```python
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, lookback_start, outlet_from_url, parse_datetime, post_json
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "exa"
FINANCE_ONLY = False
EXA_SEARCH = "https://api.exa.ai/search"


def enabled() -> bool:
    return bool(settings.exa_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Exa news search ($10 free credit/month); results carry titles and dates only."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    body = {
        "query": best_query(plan),
        "category": "news",
        "numResults": 10,
        "startPublishedDate": lookback_start(hours=24 * 7).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    payload = await post_json(client, EXA_SEARCH, source=SOURCE_NAME, json_body=body,
                              headers={"x-api-key": settings.exa_api_key})
    items = payload.get("results") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=title,
            url=url,
            source=outlet_from_url(url) or "Exa",
            published_at=parse_datetime(item.get("publishedDate")),
            country=None,
            raw_source_type="exa",
        ))
    return articles
```

- [ ] **Step 7: Register** `brave_source`, `tavily_source`, `exa_source` in `registry.py` (after `newsdata_source`).

- [ ] **Step 8: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/ingestion/brave_source.py backend/ingestion/tavily_source.py backend/ingestion/exa_source.py backend/ingestion/registry.py backend/config.py backend/tests/test_search_sources.py
git commit -m "feat(retrieval): Brave, Tavily and Exa news search sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Finance sources (Finnhub, Marketaux, Alpha Vantage)

**Files:**
- Create: `backend/ingestion/finnhub_source.py`, `backend/ingestion/marketaux_source.py`, `backend/ingestion/alphavantage_source.py`, `backend/tests/test_finance_sources.py`
- Modify: `backend/config.py`, `backend/ingestion/registry.py`

**Interfaces:**
- Consumes: Task 3 helpers (`get_json`, `parse_datetime`, `clean_text`, `outlet_from_url`, `lookback_start`, `matches_plan`, `best_query`, `quota`); Task 4 registry finance gating.
- Produces: three modules with `FINANCE_ONLY = True`; settings `finnhub_api_key`, `marketaux_api_key`, `alphavantage_api_key` (`Optional[str] = None`).

- [ ] **Step 1: Add settings** to `backend/config.py`

```python
    finnhub_api_key: Optional[str] = None
    marketaux_api_key: Optional[str] = None
    alphavantage_api_key: Optional[str] = None
```

- [ ] **Step 2: Write the failing tests** `backend/tests/test_finance_sources.py`

```python
import httpx
import pytest
import respx

from backend.config import settings
from backend.ingestion import alphavantage_source, finnhub_source, marketaux_source
from backend.ingestion.registry import SOURCES, ingest
from backend.search_plan import SearchPlan, rule_plan

FIN = SearchPlan(phrase="nvidia earnings ai chip stocks", queries=["nvidia earnings"],
                 must_terms=["nvidia", "earnings"], domains=["finance"], tickers=["NVDA"], country="US")
TOPIC_ONLY = SearchPlan(phrase="inflation outlook", queries=["inflation outlook"],
                        must_terms=["inflation"], domains=["finance"])

FINNHUB_MARKET = [
    {"headline": "Nvidia earnings beat estimates", "summary": "Chip demand.", "url": "https://ex.com/f1",
     "datetime": 1792161000, "source": "Reuters"},
    {"headline": "Oil prices slip", "summary": "Crude falls.", "url": "https://ex.com/f2",
     "datetime": 1792161000, "source": "Reuters"},
]
FINNHUB_COMPANY = [{"headline": "NVDA guidance raised", "summary": "Outlook.", "url": "https://ex.com/f3",
                    "datetime": 1792161000, "source": "Yahoo"}]
MARKETAUX = {"data": [{"title": "Nvidia shares jump", "description": "Rally.", "url": "https://www.mx.com/m",
                       "published_at": "2026-10-16T13:00:00.000000Z", "source": "mx.com"}]}
AV_FEED = {"feed": [
    {"title": "Inflation cools in September", "url": "https://av.example.com/1",
     "time_published": "20261016T143000", "summary": "CPI eases.", "source": "Benzinga"},
    {"title": "Gaming console sales", "url": "https://av.example.com/2",
     "time_published": "20261016T143000", "summary": "Holiday season.", "source": "Benzinga"},
]}


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setattr(settings, "finnhub_api_key", "fh-key")
    monkeypatch.setattr(settings, "marketaux_api_key", "mx-key")
    monkeypatch.setattr(settings, "alphavantage_api_key", "av-key")


@pytest.mark.asyncio
@respx.mock
async def test_finnhub_filters_market_news_and_adds_company_news(keys):
    market = respx.get(finnhub_source.FINNHUB_MARKET_NEWS).mock(return_value=httpx.Response(200, json=FINNHUB_MARKET))
    company = respx.get(finnhub_source.FINNHUB_COMPANY_NEWS).mock(return_value=httpx.Response(200, json=FINNHUB_COMPANY))
    async with httpx.AsyncClient() as client:
        articles = await finnhub_source.fetch(FIN, client)
    titles = [a.title for a in articles]
    assert "Nvidia earnings beat estimates" in titles
    assert "Oil prices slip" not in titles  # market news is keyword-filtered by the plan
    assert "NVDA guidance raised" in titles  # company news is not filtered
    assert all(a.raw_source_type == "finnhub" for a in articles)
    assert market.calls[0].request.headers["X-Finnhub-Token"] == "fh-key"
    assert company.calls[0].request.url.params["symbol"] == "NVDA"


@pytest.mark.asyncio
@respx.mock
async def test_marketaux_uses_symbols_when_tickers(keys):
    route = respx.get(marketaux_source.MARKETAUX_NEWS).mock(return_value=httpx.Response(200, json=MARKETAUX))
    async with httpx.AsyncClient() as client:
        articles = await marketaux_source.fetch(FIN, client)
    assert articles[0].raw_source_type == "marketaux" and articles[0].source == "mx.com"
    params = route.calls[0].request.url.params
    assert params["symbols"] == "NVDA" and "search" not in params and params["countries"] == "us"


@pytest.mark.asyncio
@respx.mock
async def test_alphavantage_topics_mode_filters_by_plan(keys):
    route = respx.get(alphavantage_source.ALPHAVANTAGE_QUERY).mock(return_value=httpx.Response(200, json=AV_FEED))
    async with httpx.AsyncClient() as client:
        articles = await alphavantage_source.fetch(TOPIC_ONLY, client)
    assert [a.title for a in articles] == ["Inflation cools in September"]
    assert articles[0].published_at.isoformat() == "2026-10-16T14:30:00+00:00"
    params = route.calls[0].request.url.params
    assert params["function"] == "NEWS_SENTIMENT" and "financial_markets" in params["topics"]


@pytest.mark.asyncio
@respx.mock
@pytest.mark.parametrize("body", [{"Information": "API rate limit reached"}, {"Note": "Thank you for using"}])
async def test_alphavantage_limit_messages_are_empty(keys, body):
    respx.get(alphavantage_source.ALPHAVANTAGE_QUERY).mock(return_value=httpx.Response(200, json=body))
    async with httpx.AsyncClient() as client:
        assert await alphavantage_source.fetch(FIN, client) == []


@pytest.mark.asyncio
@respx.mock
async def test_finance_sources_not_called_for_general_topics(keys):
    routes = [respx.get(url).mock(return_value=httpx.Response(200, json={}))
              for url in (finnhub_source.FINNHUB_MARKET_NEWS, marketaux_source.MARKETAUX_NEWS,
                          alphavantage_source.ALPHAVANTAGE_QUERY)]
    finance_sources = [s for s in SOURCES if s.finance_only]
    result = await ingest(rule_plan("data centers and privacy in the US"), finance_sources)
    assert result.stats == {}
    assert all(route.call_count == 0 for route in routes)


def test_registered_as_finance_only():
    finance = {s.name for s in SOURCES if s.finance_only}
    assert finance == {"finnhub", "marketaux", "alphavantage"}
```

- [ ] **Step 3: Run tests to verify they fail** → FAIL (modules missing).

- [ ] **Step 4: Write `backend/ingestion/finnhub_source.py`**

```python
import asyncio
from datetime import datetime, timezone

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, matches_plan, parse_datetime
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "finnhub"
FINANCE_ONLY = True
FINNHUB_MARKET_NEWS = "https://finnhub.io/api/v1/news"
FINNHUB_COMPANY_NEWS = "https://finnhub.io/api/v1/company-news"
_MAX_TICKERS = 3


def enabled() -> bool:
    return bool(settings.finnhub_api_key)


def _to_articles(items: object) -> list[Article]:
    articles: list[Article] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        title, url = clean_text(item.get("headline")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("summary")) or title,
            url=url,
            source=item.get("source") or "Finnhub",
            published_at=parse_datetime(item.get("datetime")),
            country=None,
            raw_source_type="finnhub",
        ))
    return articles


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """General market news (keyword-filtered locally) plus company news per ticker."""
    if not enabled():
        return []
    headers = {"X-Finnhub-Token": settings.finnhub_api_key}
    calls = []
    if quota.take(SOURCE_NAME):
        calls.append(get_json(client, FINNHUB_MARKET_NEWS, source=SOURCE_NAME,
                              params={"category": "general"}, headers=headers))
    start = lookback_start(hours=max(settings.hours_lookback, 72)).date().isoformat()
    end = datetime.now(timezone.utc).date().isoformat()
    tickers = [t for t in plan.tickers[:_MAX_TICKERS] if quota.take(SOURCE_NAME)]
    for ticker in tickers:
        calls.append(get_json(client, FINNHUB_COMPANY_NEWS, source=SOURCE_NAME,
                              params={"symbol": ticker, "from": start, "to": end}, headers=headers))
    if not calls:
        return []
    results = await asyncio.gather(*calls)
    market = results[0] if len(results) > len(tickers) else None
    company_results = results[-len(tickers):] if tickers else []
    articles = [a for a in _to_articles(market) if matches_plan(f"{a.title} {a.snippet}", plan)]
    for result in company_results:
        articles.extend(_to_articles(result)[: settings.max_articles_per_source])
    return articles
```

- [ ] **Step 5: Write `backend/ingestion/marketaux_source.py`**

```python
import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, lookback_start, outlet_from_url, parse_datetime
from backend.ingestion.query_format import best_query
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

SOURCE_NAME = "marketaux"
FINANCE_ONLY = True
MARKETAUX_NEWS = "https://api.marketaux.com/v1/news/all"


def enabled() -> bool:
    return bool(settings.marketaux_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """Marketaux free tier: 100 requests/day, 3 articles per request."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {
        "api_token": settings.marketaux_api_key,
        "language": "en",
        "limit": 3,
        "published_after": lookback_start(hours=max(settings.hours_lookback, 72)).strftime("%Y-%m-%dT%H:%M"),
    }
    if plan.tickers:
        params["symbols"] = ",".join(plan.tickers)
    else:
        params["search"] = best_query(plan)
    if plan.country:
        params["countries"] = plan.country.lower()
    payload = await get_json(client, MARKETAUX_NEWS, source=SOURCE_NAME, params=params)
    items = payload.get("data") if isinstance(payload, dict) else None
    articles: list[Article] = []
    for item in items or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        articles.append(Article(
            title=title,
            snippet=clean_text(item.get("description") or item.get("snippet")) or title,
            url=url,
            source=item.get("source") or outlet_from_url(url) or "Marketaux",
            published_at=parse_datetime(item.get("published_at")),
            country=None,
            raw_source_type="marketaux",
        ))
    return articles
```

- [ ] **Step 6: Write `backend/ingestion/alphavantage_source.py`**

```python
import logging

import httpx

from backend.config import settings
from backend.ingestion.common import clean_text, get_json, matches_plan, parse_datetime
from backend.ingestion.quota import quota
from backend.models import Article
from backend.search_plan import SearchPlan

logger = logging.getLogger("briefing.alphavantage")

SOURCE_NAME = "alphavantage"
FINANCE_ONLY = True
ALPHAVANTAGE_QUERY = "https://www.alphavantage.co/query"
_TOPICS = {"finance": "financial_markets,economy_macro", "tech": "technology"}


def enabled() -> bool:
    return bool(settings.alphavantage_api_key)


async def fetch(plan: SearchPlan, client: httpx.AsyncClient) -> list[Article]:
    """NEWS_SENTIMENT by tickers, or by mapped topics (then keyword-filtered). 25 requests/day free."""
    if not enabled() or not quota.take(SOURCE_NAME):
        return []
    params = {"function": "NEWS_SENTIMENT", "sort": "LATEST", "limit": 50, "apikey": settings.alphavantage_api_key}
    if plan.tickers:
        params["tickers"] = ",".join(plan.tickers)
    else:
        params["topics"] = ",".join(_TOPICS[d] for d in plan.domains if d in _TOPICS) or _TOPICS["finance"]
    payload = await get_json(client, ALPHAVANTAGE_QUERY, source=SOURCE_NAME, params=params)
    if not isinstance(payload, dict):
        return []
    if "feed" not in payload:
        # Throttling and errors come back as HTTP 200 with an Information/Note/Error message.
        logger.warning("source=alphavantage status=api_error")
        return []
    articles: list[Article] = []
    for item in payload.get("feed") or []:
        title, url = clean_text(item.get("title")), item.get("url") or ""
        if not title or not url:
            continue
        article = Article(
            title=title,
            snippet=clean_text(item.get("summary")) or title,
            url=url,
            source=item.get("source") or "Alpha Vantage",
            published_at=parse_datetime(item.get("time_published")),
            country=None,
            raw_source_type="alphavantage",
        )
        if plan.tickers or matches_plan(f"{article.title} {article.snippet}", plan):
            articles.append(article)
    return articles[: settings.max_articles_per_source]
```

- [ ] **Step 7: Register** `finnhub_source`, `marketaux_source`, `alphavantage_source` in `registry.py` (after `exa_source`).

- [ ] **Step 8: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass.

- [ ] **Step 9: Commit**

```bash
git add backend/ingestion/finnhub_source.py backend/ingestion/marketaux_source.py backend/ingestion/alphavantage_source.py backend/ingestion/registry.py backend/config.py backend/tests/test_finance_sources.py
git commit -m "feat(retrieval): finance sources (Finnhub, Marketaux, Alpha Vantage), finance-gated

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: URL normalization and exact dedupe

**Files:**
- Create: `backend/processing/urls.py`, `backend/tests/test_urls.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `models.Article`.
- Produces: `normalize_url(url: str) -> str`, `normalize_title(title: str) -> str`, `dedupe_exact(articles: list[Article]) -> list[Article]` (keeps the earliest-published copy per normalized URL or per normalized title of ≥ 4 words; preserves original relative order).

- [ ] **Step 1: Write the failing tests** `backend/tests/test_urls.py`

```python
from datetime import datetime, timedelta, timezone

from backend.processing.urls import dedupe_exact, normalize_title, normalize_url


def test_normalize_url_strips_tracking_and_www():
    assert normalize_url("https://WWW.Example.com/a/b/?utm_source=x&id=7&fbclid=abc#top") == "https://example.com/a/b?id=7"
    assert normalize_url("http://example.com") == "http://example.com/"
    assert normalize_url("not a url") == "not a url"


def test_normalize_title():
    assert normalize_title("Data Centers: Privacy fight!") == "data centers privacy fight"


def test_dedupe_exact_keeps_earliest_copy(make_article):
    now = datetime.now(timezone.utc)
    early = make_article(title="Data centers face a privacy fight", url="https://ex.com/a?utm_medium=rss",
                         published_at=now - timedelta(hours=3), source="Early")
    late_same_url = make_article(title="Different headline entirely here", url="https://www.ex.com/a",
                                 published_at=now, source="Late")
    late_same_title = make_article(title="Data Centers Face a Privacy Fight!", url="https://other.com/x",
                                   published_at=now, source="Other")
    unique = make_article(title="Short", url="https://ex.com/u")
    short_dup = make_article(title="Short", url="https://ex.com/v")  # short titles are not merged
    kept = dedupe_exact([late_same_url, early, late_same_title, unique, short_dup])
    assert [a.source for a in kept if a.url.startswith("https://ex.com/a")] == ["Early"]
    assert late_same_title not in kept
    assert unique in kept and short_dup in kept
    assert kept.index(early) < kept.index(unique)


def test_dedupe_exact_handles_missing_dates(make_article):
    a = make_article(title="Same long headline about data", url="https://x.com/1")
    a.published_at = None
    b = make_article(title="Same long headline about data", url="https://y.com/2")
    kept = dedupe_exact([a, b])
    assert kept == [b]  # dated copy wins over an undated one
```

- [ ] **Step 2: Run tests to verify they fail** → FAIL (module missing).

- [ ] **Step 3: Write `backend/processing/urls.py`**

```python
"""Exact duplicate removal across sources: normalized URLs and normalized titles."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from backend.models import Article

_TRACKING_KEYS = {"fbclid", "gclid", "ocid", "mc_cid", "mc_eid", "cmpid", "guccounter", "ref"}
_NON_WORD = re.compile(r"[^\w\s]")
_MIN_TITLE_WORDS = 4
_FAR_FUTURE = datetime.max.replace(tzinfo=timezone.utc)


def normalize_url(url: str) -> str:
    raw = url.strip()
    try:
        parts = urlsplit(raw)
    except ValueError:
        return raw
    if not parts.scheme or not parts.netloc:
        return raw
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if parts.port:
        host = f"{host}:{parts.port}"
    query = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not (k.lower().startswith("utm_") or k.lower() in _TRACKING_KEYS)
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), host, path, urlencode(query), ""))


def normalize_title(title: str) -> str:
    return " ".join(_NON_WORD.sub(" ", title.lower()).split())


def dedupe_exact(articles: list[Article]) -> list[Article]:
    """Keep the earliest-published copy of each URL/title; undated copies lose to dated ones."""
    order = sorted(range(len(articles)), key=lambda i: (articles[i].published_at or _FAR_FUTURE, i))
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    keep: set[int] = set()
    for i in order:
        article = articles[i]
        url_key = normalize_url(article.url)
        title_key = normalize_title(article.title)
        title_counts = len(title_key.split()) >= _MIN_TITLE_WORDS
        if url_key in seen_urls or (title_counts and title_key in seen_titles):
            continue
        keep.add(i)
        seen_urls.add(url_key)
        if title_counts:
            seen_titles.add(title_key)
    return [a for i, a in enumerate(articles) if i in keep]
```

- [ ] **Step 4: Wire into `backend/main.py`**: add `from backend.processing.urls import dedupe_exact`, and immediately after `articles = ingest_result.articles` (before the empty check) insert:

```python
    merged_count = len(articles)
    articles = dedupe_exact(articles)
    logger.info("exact dedupe for focus=%r: %d -> %d articles", focus, merged_count, len(articles))
```

- [ ] **Step 5: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/processing/urls.py backend/main.py backend/tests/test_urls.py
git commit -m "feat(retrieval): URL normalization and exact cross-source dedupe

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Pre-filter, Haiku rerank, pipeline wiring and briefing log line

**Files:**
- Create: `backend/processing/rerank.py`, `backend/tests/test_rerank.py`, `backend/tests/fixtures/broad_topics.py`
- Modify: `backend/config.py`, `backend/main.py`

**Interfaces:**
- Consumes: Task 1 `SearchPlan`/`rule_plan`; `processing.embeddings.embed_texts`, `cosine_similarity`; `processing.relevance.filter_by_relevance(focus, articles, embeddings)`; `focus_terms.keyword_hit`; `synthesis.briefing.extract_json`; Task 4 `IngestResult`/`SourceStat`.
- Produces: settings `rerank_enabled: bool = True`, `rerank_model: str = "claude-haiku-4-5"`, `rerank_timeout_seconds: float = 8.0`, `rerank_max_candidates: int = 60`, `rerank_keep: int = 25`; `async prefilter(plan, articles, embeddings) -> tuple[list[Article], np.ndarray]`; `async rerank(plan, candidates) -> list[Article] | None`; `@dataclass RankResult(articles: list[Article], candidates: int, reranked: bool)`; `async rank_articles(focus, plan, articles, embeddings) -> RankResult`.

- [ ] **Step 1: Add settings** to `backend/config.py`

```python
    # Relevance rerank (Haiku scores pre-filtered candidates; keyword + TF-IDF is the fallback).
    rerank_enabled: bool = True
    rerank_model: str = "claude-haiku-4-5"
    rerank_timeout_seconds: float = 8.0
    rerank_max_candidates: int = 60
    rerank_keep: int = 25
```

- [ ] **Step 2: Create the labeled fixture** `backend/tests/fixtures/broad_topics.py`

```python
"""Labeled (focus, title, snippet, relevant) rows for broad domestic topics.

The pre-filter is a recall stage: relevant rows must survive it, and noise rows
that share no plan term (including the 'us' + generic-word pattern that leaked
before) must not. Partial-term matches are the rerank's job, not tested here."""

BROAD_TOPICS = [
    ("Data centers and privacy in the US", "Data centers draw scrutiny over residents' privacy", "Local officials question data collection.", True),
    ("Data centers and privacy in the US", "Hyperscale data center plans spark privacy pushback", "Communities object to surveillance.", True),
    ("Data centers and privacy in the US", "New state privacy law targets data brokers", "Legislators pass consumer privacy rules.", True),
    ("Data centers and privacy in the US", "AI data centers strain the power grid", "Utilities warn of demand from data centers.", True),
    ("Data centers and privacy in the US", "US jobs data beat forecasts", "Hiring rose in September.", False),
    ("Data centers and privacy in the US", "What the playoffs mean for us", "Fans react to the final game.", False),
    ("Data centers and privacy in the US", "Celebrity wedding photos released", "Red carpet gallery.", False),
    ("student loans in the us", "Student loan forgiveness ruling expected", "Borrowers await the court decision.", True),
    ("student loans in the us", "Student loans servicers face complaints", "Borrowers report billing errors.", True),
    ("student loans in the us", "Mortgage rates edge higher", "Home buyers face costs.", False),
    ("student loans in the us", "Weather service warns of storms", "Heavy rain expected.", False),
    ("wildfire insurance across the United States", "Insurers retreat from wildfire zones", "Homeowners struggle to find wildfire insurance coverage.", True),
    ("wildfire insurance across the United States", "Wildfire season raises insurance premiums", "Rates climb in western states.", True),
    ("wildfire insurance across the United States", "City council approves new bike lanes", "Construction starts in spring.", False),
    ("wildfire insurance across the United States", "Movie box office weekend results", "A sequel tops the chart.", False),
]
```

- [ ] **Step 3: Write the failing tests** `backend/tests/test_rerank.py`

```python
import json
from types import SimpleNamespace

import pytest

import backend.processing.rerank as rerank_module
from backend.config import settings
from backend.processing.embeddings import embed_texts
from backend.processing.rerank import prefilter, rank_articles, rerank
from backend.search_plan import SearchPlan, rule_plan
from backend.tests.fixtures.broad_topics import BROAD_TOPICS


class _FakeAnthropic:
    reply: str | Exception = ""
    calls: list[dict] = []

    def __init__(self, **kwargs):
        self.messages = self

    async def create(self, **kwargs):
        _FakeAnthropic.calls.append(kwargs)
        if isinstance(_FakeAnthropic.reply, Exception):
            raise _FakeAnthropic.reply
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=_FakeAnthropic.reply)])


@pytest.fixture
def fake_llm(monkeypatch):
    _FakeAnthropic.calls = []
    monkeypatch.setattr(rerank_module, "AsyncAnthropic", _FakeAnthropic)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "rerank_enabled", True)
    return _FakeAnthropic


async def _embed(articles):
    return await embed_texts([f"{a.title}. {a.snippet}" for a in articles])


@pytest.mark.asyncio
async def test_broad_topic_prefilter_keeps_relevant_and_rejects_noise(make_article):
    focuses = sorted({row[0] for row in BROAD_TOPICS})
    for focus in focuses:
        rows = [r for r in BROAD_TOPICS if r[0] == focus]
        articles = [make_article(title=t, snippet=s) for _, t, s, _ in rows]
        kept, _ = await prefilter(rule_plan(focus), articles, await _embed(articles))
        relevant = [a for a, row in zip(articles, rows) if row[3]]
        noise = [a for a, row in zip(articles, rows) if not row[3]]
        recall = sum(a in kept for a in relevant) / len(relevant)
        assert recall >= 0.9, f"{focus}: recall {recall:.2f}"
        assert not any(a in kept for a in noise), f"{focus}: noise leaked {[a.title for a in noise if a in kept]}"


@pytest.mark.asyncio
async def test_prefilter_caps_candidates_and_tolerates_missing_dates(make_article, monkeypatch):
    monkeypatch.setattr(settings, "rerank_max_candidates", 3)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    articles = [make_article(title=f"Privacy story {i}", snippet="privacy") for i in range(6)]
    articles[0].published_at = None
    kept, emb = await prefilter(plan, articles, await _embed(articles))
    assert len(kept) == 3 and emb.shape[0] == 3


@pytest.mark.asyncio
async def test_rerank_applies_scores_threshold_and_cap(fake_llm, make_article, monkeypatch):
    monkeypatch.setattr(settings, "rerank_keep", 2)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    cands = [make_article(title=f"t{i}") for i in range(4)]
    fake_llm.reply = json.dumps({"scores": [{"i": 0, "s": 1}, {"i": 1, "s": 3}, {"i": 2, "s": 2}, {"i": 99, "s": 3}]})
    kept = await rerank(plan, cands)
    assert kept == [cands[1], cands[2]]  # score 3 first, then 2; index 3 missing -> 0; 99 ignored
    assert fake_llm.calls[0]["model"] == settings.rerank_model


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["no json", json.dumps({"nope": []}), TimeoutError("slow")])
async def test_rerank_failures_return_none(fake_llm, make_article, reply):
    fake_llm.reply = reply
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    assert await rerank(plan, [make_article()]) is None


@pytest.mark.asyncio
async def test_rerank_disabled_without_key(make_article, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    assert await rerank(plan, [make_article()]) is None


@pytest.mark.asyncio
async def test_rank_articles_falls_back_to_relevance_filter(make_article, monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", None)
    plan = rule_plan("trade policy")
    articles = [make_article(title="Trade policy shifts", snippet="Tariffs rise."),
                make_article(title="Gallery of photos", snippet="Red carpet.")]
    result = await rank_articles("trade policy", plan, articles, await _embed(articles))
    assert result.reranked is False
    assert [a.title for a in result.articles] == ["Trade policy shifts"]
    assert result.candidates == 1


@pytest.mark.asyncio
async def test_rank_articles_uses_rerank_when_available(fake_llm, make_article):
    plan = SearchPlan(phrase="privacy", queries=["privacy"], must_terms=["privacy"])
    articles = [make_article(title="Privacy bill advances"), make_article(title="Privacy app update")]
    fake_llm.reply = json.dumps({"scores": [{"i": 0, "s": 3}, {"i": 1, "s": 0}]})
    result = await rank_articles("privacy", plan, articles, await _embed(articles))
    assert result.reranked is True
    assert len(result.articles) == 1

```

- [ ] **Step 4: Run tests to verify they fail** → FAIL (`backend.processing.rerank` missing).

- [ ] **Step 5: Write `backend/processing/rerank.py`**

```python
"""Relevance ranking: deterministic pre-filter to a capped candidate set, then a
Haiku relevance score per candidate. Falls back to the keyword + TF-IDF filter."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from anthropic import AsyncAnthropic

from backend.config import settings
from backend.focus_terms import keyword_hit
from backend.models import Article
from backend.search_plan import SearchPlan
from backend.synthesis.briefing import extract_json

from .embeddings import cosine_similarity, embed_texts
from .relevance import filter_by_relevance

logger = logging.getLogger("briefing.rerank")

RERANK_SYSTEM_PROMPT = """You score news articles for relevance to a briefing focus.
Scores: 3 = directly about the focus; 2 = substantially relevant; 1 = tangential mention; 0 = unrelated.
Judge only by the title and snippet given.
Return ONLY a JSON object: {"scores": [{"i": <article index>, "s": <0-3>}, ...]} with one entry per article."""


@dataclass
class RankResult:
    articles: list[Article]
    candidates: int
    reranked: bool


async def prefilter(plan: SearchPlan, articles: list[Article], embeddings: np.ndarray) -> tuple[list[Article], np.ndarray]:
    """Keep articles hitting a plan term or similar enough to the plan; cap and order them."""
    if not articles:
        return articles, embeddings
    terms = plan.match_terms
    focus_emb = await embed_texts([" ".join([plan.phrase, *terms])])
    sims = cosine_similarity(focus_emb, embeddings)[0] if embeddings.size else np.zeros(len(articles))
    scored: list[tuple[int, float, float, int]] = []
    for i, article in enumerate(articles):
        text = f"{article.title} {article.snippet}"
        hits = sum(1 for term in terms if keyword_hit(text, [term]))
        sim = float(sims[i]) if i < len(sims) else 0.0
        if hits == 0 and sim < settings.relevance_similarity_threshold:
            continue
        recency = article.published_at.timestamp() if article.published_at else 0.0
        scored.append((hits, sim, recency, i))
    scored.sort(key=lambda row: (row[0], row[1], row[2]), reverse=True)
    idx = [row[3] for row in scored[: settings.rerank_max_candidates]]
    kept_emb = embeddings[idx] if embeddings.size and idx else np.zeros((0, embeddings.shape[1] if embeddings.ndim == 2 else 0), dtype=np.float32)
    return [articles[i] for i in idx], kept_emb


def _prompt(plan: SearchPlan, candidates: list[Article]) -> str:
    lines = []
    for i, article in enumerate(candidates):
        date = article.published_at.date().isoformat() if article.published_at else "date unknown"
        snippet = " ".join(article.snippet.split())[:300]
        lines.append(f"[{i}] {article.title} | {article.source} | {date}\n{snippet}")
    header = f"Focus: {plan.phrase}\nRequired concepts: {', '.join(plan.must_terms) or plan.phrase}\n"
    if plan.country:
        header += f"Coverage country: {plan.country}\n"
    return header + "\nArticles:\n" + "\n\n".join(lines)


def _parse_scores(data: dict, count: int) -> dict[int, int]:
    items = data.get("scores")
    if not isinstance(items, list):
        raise ValueError("rerank reply has no scores list")
    scores: dict[int, int] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        index, score = item.get("i"), item.get("s")
        if isinstance(index, int) and not isinstance(index, bool) and 0 <= index < count and isinstance(score, (int, float)):
            scores[index] = max(0, min(3, int(score)))
    return scores


async def rerank(plan: SearchPlan, candidates: list[Article]) -> list[Article] | None:
    """Haiku relevance scores; None when disabled, unavailable, or the reply is unusable."""
    if not candidates or not (settings.rerank_enabled and settings.anthropic_api_key):
        return None
    try:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key, timeout=settings.rerank_timeout_seconds, max_retries=0)
        response = await client.messages.create(
            model=settings.rerank_model,
            max_tokens=1500,
            system=RERANK_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _prompt(plan, candidates)}],
        )
        raw = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
        scores = _parse_scores(extract_json(raw), len(candidates))
    except Exception as exc:  # timeout, API error, invalid JSON: fall back to the deterministic filter
        logger.warning("rerank failed (%s); using keyword + TF-IDF fallback", type(exc).__name__)
        return None
    ranked = sorted((i for i, s in scores.items() if s >= 2), key=lambda i: (-scores[i], i))
    return [candidates[i] for i in ranked[: settings.rerank_keep]]


async def rank_articles(focus: str, plan: SearchPlan, articles: list[Article], embeddings: np.ndarray) -> RankResult:
    candidates, candidate_emb = await prefilter(plan, articles, embeddings)
    ranked = await rerank(plan, candidates)
    if ranked is not None:
        return RankResult(articles=ranked, candidates=len(candidates), reranked=True)
    kept, _ = await filter_by_relevance(focus, candidates, candidate_emb)
    return RankResult(articles=kept[: settings.rerank_keep], candidates=len(candidates), reranked=False)
```

- [ ] **Step 6: Wire ranking into `backend/main.py`**

Add `import time` (already imported), and `from backend.processing.rerank import rank_articles`. Record `ingest_started = time.monotonic()` just before `plan = await plan_search(focus)`. Replace the line `articles, embeddings = await filter_by_relevance(focus, articles, embeddings)` with:

```python
    rank_result = await rank_articles(focus, plan, articles, embeddings)
    deduped_count = len(articles)
    articles = rank_result.articles
    logger.info(
        "briefing pipeline focus=%r plan=%s queries=%s country=%s domains=%s sources=%s "
        "merged=%d deduped=%d candidates=%d kept=%d reranked=%s elapsed_ms=%d",
        focus, plan.source, plan.queries, plan.country, plan.domains,
        {name: f"{s.count}/{s.status}/{s.ms}ms" for name, s in ingest_result.stats.items()},
        merged_count, deduped_count, rank_result.candidates, len(articles), rank_result.reranked,
        int((time.monotonic() - ingest_started) * 1000),
    )
```

Remove `filter_by_relevance` from the `backend.processing` import in `main.py` if it is no longer used there.

- [ ] **Step 7: Run tests** — `~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass (including `test_api.py`, which runs the full pipeline in demo mode: rule plan, fallback ranking).

- [ ] **Step 8: Commit**

```bash
git add backend/processing/rerank.py backend/main.py backend/config.py backend/tests/test_rerank.py backend/tests/fixtures/broad_topics.py
git commit -m "feat(retrieval): candidate pre-filter and Haiku rerank with fallback; pipeline log line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Configuration docs, frontend source labels, final verification

**Files:**
- Modify: `render.yaml`, `backend/.env.example`, `backend/README.md`, `frontend/src/lib/signals.ts`, `frontend/src/lib/signals.test.ts`

**Interfaces:**
- Consumes: all settings added in Tasks 2–10.
- Produces: documented configuration; `SOURCE_LABELS` entries for the 10 new source names.

- [ ] **Step 1: Write the failing frontend test** — append to `frontend/src/lib/signals.test.ts`:

```ts
describe('SOURCE_LABELS', () => {
  it('labels every backend source type', () => {
    for (const key of ['newsapi', 'gdelt', 'rss', 'google_news', 'guardian', 'gnews', 'newsdata',
      'brave', 'tavily', 'exa', 'finnhub', 'marketaux', 'alphavantage']) {
      expect(SOURCE_LABELS[key]).toBeTruthy()
    }
    expect(SOURCE_LABELS.google_news).toBe('Google News')
    expect(SOURCE_LABELS.alphavantage).toBe('Alpha Vantage')
  })
})
```

Run: `cd /tmp/atlasbrief/frontend && npx vitest run src/lib/signals.test.ts` → FAIL.

- [ ] **Step 2: Extend `SOURCE_LABELS`** in `frontend/src/lib/signals.ts`:

```ts
export const SOURCE_LABELS: Record<string, string> = {
  newsapi: 'NewsAPI',
  gdelt: 'GDELT',
  rss: 'Wire feeds',
  google_news: 'Google News',
  guardian: 'The Guardian',
  gnews: 'GNews',
  newsdata: 'NewsData',
  brave: 'Brave News',
  tavily: 'Tavily',
  exa: 'Exa',
  finnhub: 'Finnhub',
  marketaux: 'Marketaux',
  alphavantage: 'Alpha Vantage',
}
```

Run the test again → PASS.

- [ ] **Step 3: Document configuration**

In `render.yaml`, add under `envVars` (after `NEWSAPI_KEY`):

```yaml
      # Optional news sources; each is skipped when its key is unset.
      - key: GUARDIAN_API_KEY
        sync: false
      - key: GNEWS_API_KEY
        sync: false
      - key: NEWSDATA_API_KEY
        sync: false
      - key: BRAVE_API_KEY
        sync: false
      - key: TAVILY_API_KEY
        sync: false
      - key: EXA_API_KEY
        sync: false
      - key: FINNHUB_API_KEY
        sync: false
      - key: MARKETAUX_API_KEY
        sync: false
      - key: ALPHAVANTAGE_API_KEY
        sync: false
      - key: SOURCE_TIMEOUT_SECONDS
        value: "8"
      - key: INGEST_DEADLINE_SECONDS
        value: "15"
      - key: SEARCH_PLAN_ENABLED
        value: "true"
      - key: RERANK_ENABLED
        value: "true"
```

In `backend/.env.example`, add after `NEWSAPI_KEY=`:

```
# Optional sources (free tiers). Each source is skipped when its key is empty.
GUARDIAN_API_KEY=
GNEWS_API_KEY=
NEWSDATA_API_KEY=
BRAVE_API_KEY=
TAVILY_API_KEY=
EXA_API_KEY=
FINNHUB_API_KEY=
MARKETAUX_API_KEY=
ALPHAVANTAGE_API_KEY=
```

In `backend/README.md`, replace the "Architecture (5 layers)" list's step 2–3 text and the "Required keys" list with:

```markdown
2. **Plan** — `search_plan.py` turns the focus into a `SearchPlan` (queries, must-terms, synonyms, coverage country, domains, tickers) with Claude Haiku, falling back to deterministic rules.
3. **Ingestion** — `ingestion/registry.py` runs every enabled source in parallel (8 s per source, 15 s overall), each guarded by a daily quota: NewsAPI, GDELT, curated RSS (world, US, tech and finance desks), Google News RSS search, The Guardian, GNews, NewsData.io, Brave News, Tavily, Exa, and — for finance topics only — Finnhub, Marketaux and Alpha Vantage.
4. **Processing** — exact URL/title dedupe (`processing/urls.py`), embedding dedupe, a candidate pre-filter, and a Claude Haiku relevance rerank (`processing/rerank.py`) with the keyword + TF-IDF filter as fallback.
```

and

```markdown
Keys in `.env` (all optional except Anthropic for real synthesis):

| Variable | Where to get it | Free tier |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | paid usage |
| `NEWSAPI_KEY` | newsapi.org | 100/day, 24 h delay, development plan |
| `GUARDIAN_API_KEY` | open-platform.theguardian.com | 5,000/day |
| `GNEWS_API_KEY` | gnews.io | 100/day, 12 h delay, non-commercial |
| `NEWSDATA_API_KEY` | newsdata.io | 200 credits/day |
| `BRAVE_API_KEY` | brave.com/search/api | ~$5 monthly credit (card required) |
| `TAVILY_API_KEY` | tavily.com | 1,000 credits/month |
| `EXA_API_KEY` | exa.ai | $10 monthly credit |
| `FINNHUB_API_KEY` | finnhub.io | 60 calls/min |
| `MARKETAUX_API_KEY` | marketaux.com | 100/day |
| `ALPHAVANTAGE_API_KEY` | alphavantage.co | 25/day |

GDELT, the RSS feeds and Google News RSS search need no key. Daily request budgets per source are configurable with `QUOTA_<SOURCE>_PER_DAY` (see `config.py`).
```

Also update the "Run" command to `uvicorn backend.main:app --reload --port 8000` (run from the repo root), matching `render.yaml`.

- [ ] **Step 4: Full verification**

Run backend: `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief" && ~/.venvs/atlasbrief/bin/python -m pytest -q` → all pass, output free of warnings.
Run frontend: `cd /tmp/atlasbrief/frontend && npx vitest run` → all pass; `cd "/Users/camlau/Desktop/cs/personal/Atlas Brief/frontend" && npm run build && npm run lint` → build succeeds, lint 0 warnings.
Confirm no stale references: `grep -rn "build_boolean_query\|fetch_newsapi\|fetch_gdelt\|fetch_rss" backend` → no matches.

- [ ] **Step 5: Commit**

```bash
git add render.yaml backend/.env.example backend/README.md frontend/src/lib/signals.ts frontend/src/lib/signals.test.ts
git commit -m "docs(retrieval): source keys and settings; frontend labels for new sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Manual end-to-end check (owner, with keys in `backend/.env`)**

Run `~/.venvs/atlasbrief/bin/uvicorn backend.main:app --port 8000` from the repo root, then:

```bash
curl -s -X POST localhost:8000/briefing -H 'Content-Type: application/json' -d '{"focus":"Data centers and privacy in the US"}' | python3 -c "import json,sys; b=json.load(sys.stdin); print(b['article_count'], b['source_breakdown']); print([d['headline'] for d in b['key_developments']])"
```

Expected: the `briefing pipeline` log line shows `kept` ≥ 15 from ≥ 4 source types, `source_breakdown` lists ≥ 4 sources, and key developments are about data centers and privacy. Repeat for "Nvidia earnings and AI chip stocks" (finance sources appear in the log), "South Asian security", "Regeneron", and "Red Sea shipping" (no off-topic key developments). Note per-stage times from the log line; uncached total should be within ~8 s of the previous pipeline.
