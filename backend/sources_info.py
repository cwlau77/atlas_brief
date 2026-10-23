"""What Atlas reads, for Home's source counts and "How Atlas reads" section.
Computed from config on each call: no network, no LLM, cheap enough to skip a cache."""

from __future__ import annotations

from backend.ingestion.registry import SOURCES
from backend.ingestion.rss_source import RSS_FEEDS, feed_outlets


def sources_payload() -> dict:
    return {
        "services": [
            {"name": s.name, "label": s.label, "enabled": bool(s.enabled()), "finance_only": s.finance_only}
            for s in SOURCES
            if s.name != "rss"  # the newsroom feeds are described by `feeds`
        ],
        "feeds": {"count": len(RSS_FEEDS), "outlets": feed_outlets()},
    }
