import numpy as np

from backend.config import settings
from backend.models import Article
from backend.processing.urls import with_image_of


def deduplicate(articles: list[Article], embeddings: np.ndarray) -> tuple[list[Article], np.ndarray]:
    """Greedy near-duplicate removal: keep the first article, drop any later article
    whose embedding has cosine similarity >= threshold with an already-kept one.
    Exact URL/title duplicates are removed earlier by processing.urls.dedupe_exact.

    Returns (kept_articles, kept_embeddings) with aligned indices.
    """
    if not articles or embeddings.size == 0:
        return articles, embeddings

    threshold = settings.dedup_similarity_threshold
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    normed = embeddings / norms

    kept_indices: list[int] = []
    kept_vecs: list[np.ndarray] = []
    kept_articles: list[Article] = []

    for i in range(len(articles)):
        if kept_vecs:
            stack = np.stack(kept_vecs)
            sims = stack @ normed[i]
            best = int(sims.argmax())
            if float(sims[best]) >= threshold:
                # A dropped near-duplicate may carry the only image; hand it to the survivor.
                if kept_articles[best].image_url is None and articles[i].image_url:
                    kept_articles[best] = with_image_of(kept_articles[best], articles[i])
                continue

        kept_indices.append(i)
        kept_vecs.append(normed[i])
        kept_articles.append(articles[i])

    kept_embeddings = embeddings[kept_indices] if kept_indices else np.zeros((0, embeddings.shape[1]), dtype=np.float32)
    return kept_articles, kept_embeddings
