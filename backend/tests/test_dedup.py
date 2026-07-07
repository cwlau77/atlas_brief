import pytest

from backend.processing.dedup import deduplicate
from backend.processing.embeddings import embed_texts


@pytest.mark.asyncio
async def test_dedup_drops_near_duplicates_and_same_urls(make_article):
    articles = [
        make_article(title="Ceasefire talks resume in Cairo amid pressure", url="https://a.com/1"),
        make_article(title="Ceasefire talks resume in Cairo amid new pressure", url="https://b.com/2"),
        make_article(title="Completely different quantum computing breakthrough story", url="https://a.com/1"),
        make_article(title="Volcano erupts in Iceland disrupting flights", url="https://c.com/3"),
    ]
    emb = await embed_texts([f"{a.title}. {a.snippet}" for a in articles])
    kept, kept_emb = deduplicate(articles, emb)
    urls = [a.url for a in kept]
    assert "https://c.com/3" in urls
    assert len(kept) < len(articles)
    assert len(kept) == kept_emb.shape[0]


@pytest.mark.asyncio
async def test_dedup_keeps_everything_when_distinct(make_article):
    articles = [
        make_article(title="Volcano erupts in Iceland disrupting flights", url="https://a.com/1"),
        make_article(title="Central bank raises interest rates unexpectedly", url="https://b.com/2"),
        make_article(title="Wheat harvest collapses after regional drought", url="https://c.com/3"),
    ]
    emb = await embed_texts([f"{a.title}. {a.snippet}" for a in articles])
    kept, _ = deduplicate(articles, emb)
    assert len(kept) == 3
