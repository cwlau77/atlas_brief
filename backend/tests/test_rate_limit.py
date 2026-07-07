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
