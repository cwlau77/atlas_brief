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
