"""Cloudflare Turnstile check for POST /briefing: proves a browser, not a script,
asked for the briefing. Off when TURNSTILE_SECRET_KEY is unset (local dev).

An explicit rejection from Cloudflare is refused. If Cloudflare itself can't be
reached the request is let through: the global briefing budget still bounds
spend, and an outage there shouldn't take Atlas down.
"""

from __future__ import annotations

import logging

import httpx

from backend.config import settings

logger = logging.getLogger("briefing.turnstile")

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify(token: str | None) -> bool:
    secret = settings.turnstile_secret_key
    if not secret:
        return True
    if not token:
        # Usually a page loaded before the site key went live, or a script calling the API directly.
        logger.warning("turnstile status=missing_token")
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(SITEVERIFY_URL, data={"secret": secret, "response": token})
        resp.raise_for_status()
        result = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("turnstile status=unreachable detail=%s; allowing request", type(exc).__name__)
        return True
    if result.get("success"):
        return True
    # Cloudflare's reason, e.g. invalid-input-secret (wrong key on the server) or timeout-or-duplicate.
    logger.warning("turnstile status=rejected errors=%s", ",".join(result.get("error-codes") or []) or "none")
    return False
