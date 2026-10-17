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
        if (
            isinstance(index, int) and not isinstance(index, bool) and 0 <= index < count
            and isinstance(score, (int, float)) and not isinstance(score, bool)
        ):
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
        if not scores:
            # No usable entries at all (empty "scores" list, or every entry
            # had the wrong keys/types) -- treat as a malformed reply and
            # fall back, same as invalid JSON. A reply with valid entries
            # that all score below the keep threshold is NOT this case: it
            # produces a non-empty scores dict and correctly returns [].
            raise ValueError("rerank reply had no usable score entries")
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
    # Use the plan's place-stripped phrase, not the raw focus: "... in the
    # United States" would otherwise make "united"/"states" count as
    # keywords in the fallback filter, letting place-name mentions alone
    # pass articles that aren't actually about the focus.
    fallback_focus = plan.phrase or focus
    kept, _ = await filter_by_relevance(fallback_focus, candidates, candidate_emb)
    return RankResult(articles=kept[: settings.rerank_keep], candidates=len(candidates), reranked=False)
