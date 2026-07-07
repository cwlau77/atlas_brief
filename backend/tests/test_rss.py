from backend.ingestion.rss_source import RSS_FEEDS, _parse_feed

FIXTURE = """<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
<item><title>Trade tariffs escalate between blocs</title><link>https://f.com/1</link><description>Tariff rise.</description></item>
<item><title>Celebrity gala photos</title><link>https://f.com/2</link><description>Red carpet.</description></item>
</channel></rss>"""


def test_parse_feed_filters_by_keywords():
    arts = _parse_feed("Fixture", FIXTURE, ["tariff", "tariffs", "trade"])  # feedparser accepts raw strings
    assert [a.url for a in arts] == ["https://f.com/1"]


def test_parse_feed_returns_empty_when_nothing_matches():
    # No permissive fallback — regression guard for the "only-Iran" bug.
    assert _parse_feed("Fixture", FIXTURE, ["volcano"]) == []


def test_feed_list_covers_non_western_outlets():
    outlets = {name for name, _ in RSS_FEEDS}
    assert len(outlets) >= 8
    assert {"The Hindu", "Deutsche Welle", "France 24", "AllAfrica", "Straits Times"} <= outlets
