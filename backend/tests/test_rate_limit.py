from backend.rate_limit import SlidingWindowLimiter


def test_allows_up_to_limit_then_blocks():
    lim = SlidingWindowLimiter(max_requests=3, window_seconds=60)
    assert all(lim.allow("1.2.3.4", now=float(i)) for i in range(3))
    assert not lim.allow("1.2.3.4", now=3.0)
    assert lim.allow("5.6.7.8", now=3.0)  # other clients unaffected


def test_window_slides():
    lim = SlidingWindowLimiter(max_requests=2, window_seconds=10)
    assert lim.allow("k", now=0.0)
    assert lim.allow("k", now=1.0)
    assert not lim.allow("k", now=5.0)
    assert lim.allow("k", now=10.1)  # first hit expired


def test_global_budget_enforces_both_windows_without_double_counting():
    from backend.rate_limit import GlobalBudget
    budget = GlobalBudget(per_hour=2, per_day=3)
    assert budget.allow(now=0.0) and budget.allow(now=1.0)
    assert not budget.allow(now=2.0)              # hour full
    assert budget.allow(now=3601.0)               # hour slid; day now at 3
    assert not budget.allow(now=7300.0)           # day full, even though the hour is empty
    assert budget.allow(now=86402.0)              # day slid past the first two
    # A refusal by the daily window must not have used up hourly room, and vice versa.
    tight = GlobalBudget(per_hour=5, per_day=1)
    assert tight.allow(now=0.0)
    for t in range(1, 5):
        assert not tight.allow(now=float(t))
    assert tight.allow(now=86401.0)


def test_global_budget_zero_disables_a_window():
    from backend.rate_limit import GlobalBudget
    budget = GlobalBudget(per_hour=0, per_day=0)
    assert all(budget.allow(now=float(i)) for i in range(100))


def test_limiter_forgets_idle_clients():
    lim = SlidingWindowLimiter(max_requests=1, window_seconds=10)
    for i in range(50):
        assert lim.allow(f"10.0.0.{i}", now=0.0)
    lim.allow("late", now=100.0)
    lim.sweep(now=100.0)
    assert set(lim._hits) == {"late"}
