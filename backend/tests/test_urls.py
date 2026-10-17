from datetime import datetime, timedelta, timezone

from backend.processing.urls import dedupe_exact, normalize_title, normalize_url


def test_normalize_url_strips_tracking_and_www():
    assert normalize_url("https://WWW.Example.com/a/b/?utm_source=x&id=7&fbclid=abc#top") == "https://example.com/a/b?id=7"
    assert normalize_url("http://example.com") == "http://example.com/"
    assert normalize_url("not a url") == "not a url"


def test_normalize_url_tolerates_malformed_port():
    assert normalize_url("http://example.com:abc/x") == "http://example.com:abc/x"


def test_normalize_title():
    assert normalize_title("Data Centers: Privacy fight!") == "data centers privacy fight"


def test_dedupe_exact_keeps_earliest_copy(make_article):
    now = datetime.now(timezone.utc)
    early = make_article(title="Data centers face a privacy fight", url="https://ex.com/a?utm_medium=rss",
                         published_at=now - timedelta(hours=3), source="Early")
    late_same_url = make_article(title="Different headline entirely here", url="https://www.ex.com/a",
                                 published_at=now, source="Late")
    late_same_title = make_article(title="Data Centers Face a Privacy Fight!", url="https://other.com/x",
                                   published_at=now, source="Other")
    unique = make_article(title="Short", url="https://ex.com/u")
    short_dup = make_article(title="Short", url="https://ex.com/v")  # short titles are not merged
    kept = dedupe_exact([late_same_url, early, late_same_title, unique, short_dup])
    assert [a.source for a in kept if a.url.startswith("https://ex.com/a")] == ["Early"]
    assert late_same_title not in kept
    assert unique in kept and short_dup in kept
    assert kept.index(early) < kept.index(unique)


def test_dedupe_exact_handles_missing_dates(make_article):
    a = make_article(title="Same long headline about data", url="https://x.com/1")
    a.published_at = None
    b = make_article(title="Same long headline about data", url="https://y.com/2")
    kept = dedupe_exact([a, b])
    assert kept == [b]  # dated copy wins over an undated one
