"""The one place that talks to Claude: planning, rerank, synthesis and context all go through here."""

from anthropic import AsyncAnthropic

from backend.config import settings


async def complete(
    *,
    model: str,
    system: str,
    messages: list[dict],
    max_tokens: int,
    timeout: float | None = None,
) -> str:
    """Send one Messages request and return the reply's joined text blocks.

    A `timeout` also disables the SDK's automatic retries, so callers with a
    latency budget fail fast and use their own fallback.
    """
    options: dict = {"api_key": settings.anthropic_api_key}
    if timeout is not None:
        options.update(timeout=timeout, max_retries=0)
    client = AsyncAnthropic(**options)
    response = await client.messages.create(model=model, max_tokens=max_tokens, system=system, messages=messages)
    return "".join(block.text for block in response.content if getattr(block, "type", "") == "text").strip()
