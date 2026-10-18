import asyncio

from backend import llm
from backend.config import settings
from backend.models import Briefing, KeyDevelopment

CONTEXT_SYSTEM_PROMPT = """You are a concise historical briefer for international-affairs students.
Given a news headline and summary, write ONE short paragraph (2-4 sentences) of historical and
structural context that helps a student understand why this development matters.

Rules:
- Draw on widely-accepted historical knowledge only; do not invent specific statistics or quotes.
- Focus on WHY: precedents, long-running dynamics, prior related events.
- No preamble, no meta-commentary, no hedging disclaimers. Just the paragraph."""


async def _context_for_development(dev: KeyDevelopment) -> str:
    user_prompt = (
        f"Headline: {dev.headline}\n"
        f"Summary: {dev.summary}\n"
        f"Regions: {', '.join(dev.regions) if dev.regions else 'global'}"
    )
    try:
        return await llm.complete(
            model=settings.context_model,
            system=CONTEXT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
            max_tokens=400,
        )
    except Exception:
        return ""


async def enrich_with_historical_context(briefing: Briefing) -> Briefing:
    """Attach a short Haiku-generated historical-context paragraph to the top
    `context_enrichment_limit` key developments. Remaining developments are
    returned without context to keep total response time manageable.
    """
    if not briefing.key_developments or not settings.anthropic_api_key:
        return briefing

    limit = max(0, settings.context_enrichment_limit)
    targets = briefing.key_developments[:limit]
    if not targets:
        return briefing

    results = await asyncio.gather(*(_context_for_development(dev) for dev in targets))
    for dev, ctx in zip(targets, results):
        if ctx:
            dev.historical_context = ctx
    return briefing
