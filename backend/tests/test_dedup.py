import pytest

from backend.processing.dedup import deduplicate
from backend.processing.embeddings import embed_texts


@pytest.mark.asyncio
async def test_dedup_drops_near_duplicates(make_article):
    articles = [
        make_article(title="Ceasefire talks resume in Cairo amid pressure", url="https://a.com/1"),
        make_article(title="Ceasefire talks resume in Cairo amid new pressure", url="https://b.com/2"),
        make_article(title="Volcano erupts in Iceland disrupting flights", url="https://c.com/3"),
    ]
    emb = await embed_texts([f"{a.title}. {a.snippet}" for a in articles])
    kept, kept_emb = deduplicate(articles, emb)
    assert [a.url for a in kept] == ["https://a.com/1", "https://c.com/3"]
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


def test_deduplicate_keeps_an_image_from_a_dropped_near_duplicate(make_article):
    import numpy as np
    articles = [
        make_article(title="Ceasefire talks resume", url="https://a.com/1"),
        make_article(title="Ceasefire talks resume again", url="https://b.com/2", image_url="https://i.ex/2.jpg",
                     source="AP"),
    ]
    emb = np.array([[1.0, 0.0], [1.0, 0.0]], dtype=np.float32)
    kept, _ = deduplicate(articles, emb)
    assert [a.url for a in kept] == ["https://a.com/1"]
    assert kept[0].image_url == "https://i.ex/2.jpg"
    assert kept[0].image_outlet == "AP" and kept[0].source == "TestWire"
