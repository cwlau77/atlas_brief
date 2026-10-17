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
