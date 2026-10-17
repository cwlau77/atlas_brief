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
