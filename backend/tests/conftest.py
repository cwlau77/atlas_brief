from datetime import datetime, timezone

import pytest

from backend.models import Article


@pytest.fixture
def make_article():
    def _make(title="Sample headline", snippet="Sample snippet", url=None,
              source="TestWire", raw_source_type="rss", published_at=None):
        return Article(
            title=title,
            snippet=snippet,
            url=url or f"https://example.com/{abs(hash(title))}",
            source=source,
            published_at=published_at or datetime.now(timezone.utc),
            country=None,
            raw_source_type=raw_source_type,
        )
    return _make
