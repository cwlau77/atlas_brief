"""In-memory per-key sliding-window rate limiter.

Single-process only — matches the deployment model (one long-running Render
instance), same rationale as the in-memory briefing cache in main.py.
"""

import time
from collections import defaultdict, deque


# Forget idle clients every this many calls, so the table can't grow without bound.
_SWEEP_EVERY = 1024


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._calls = 0

    def _trim(self, q: deque[float], now: float) -> None:
        cutoff = now - self.window_seconds
        while q and q[0] <= cutoff:
            q.popleft()

    def has_room(self, key: str, now: float) -> bool:
        q = self._hits.get(key)
        if q is None:
            return self.max_requests > 0
        self._trim(q, now)
        return len(q) < self.max_requests

    def record(self, key: str, now: float) -> None:
        self._hits[key].append(now)

    def allow(self, key: str, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        self._calls += 1
        if self._calls % _SWEEP_EVERY == 0:
            self.sweep(now)
        if not self.has_room(key, now):
            return False
        self.record(key, now)
        return True

    def sweep(self, now: float | None = None) -> None:
        """Drop clients with no hits left in the window."""
        now = time.monotonic() if now is None else now
        for key in list(self._hits):
            q = self._hits[key]
            self._trim(q, now)
            if not q:
                del self._hits[key]


class GlobalBudget:
    """A cap on new (uncached) briefings across every client, per hour and per day.

    This, not the per-IP limit, bounds what the server can spend on Claude and
    the news APIs: per-IP limits are defeated by an attacker with many addresses.
    A window set to 0 is unlimited. A refusal consumes nothing from either window.
    """

    def __init__(self, per_hour: int, per_day: int) -> None:
        self._windows = [
            SlidingWindowLimiter(limit, seconds)
            for limit, seconds in ((per_hour, 3600.0), (per_day, 86400.0))
            if limit > 0
        ]

    def allow(self, now: float | None = None) -> bool:
        now = time.monotonic() if now is None else now
        if not all(w.has_room("all", now) for w in self._windows):
            return False
        for w in self._windows:
            w.record("all", now)
        return True
