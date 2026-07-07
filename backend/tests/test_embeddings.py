import numpy as np
import pytest

from backend.processing.embeddings import cosine_similarity, embed_texts


@pytest.mark.asyncio
async def test_embeddings_deterministic_and_normalized():
    a = await embed_texts(["climate summit in geneva"])
    b = await embed_texts(["climate summit in geneva"])
    assert np.allclose(a, b)
    assert abs(float(np.linalg.norm(a[0])) - 1.0) < 1e-5


@pytest.mark.asyncio
async def test_empty_input_returns_well_shaped_matrix():
    m = await embed_texts([])
    assert m.shape == (0, 512)


@pytest.mark.asyncio
async def test_related_texts_more_similar_than_unrelated():
    m = await embed_texts([
        "climate change emissions targets announced",
        "carbon emissions rise despite climate pledges",
        "football transfer window gossip roundup",
    ])
    sims = cosine_similarity(m[:1], m[1:])
    assert float(sims[0][0]) > float(sims[0][1])
