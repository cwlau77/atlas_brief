"""Local hashing vectorizer (unigrams + half-weight bigrams) for article/focus similarity.

Deterministic across processes (zlib.crc32) and free of network calls; for tens
of articles per request it separates on-topic from off-topic well enough for the
dedup, prefilter and fallback relevance passes.
"""

import logging
import re
import zlib
import numpy as np

logger = logging.getLogger("briefing.embeddings")

# 512 bins is plenty for tens of articles — low enough to be fast, high enough
# to have few hash collisions on real vocabulary.
_DIM = 512

_TOKEN_PAT = re.compile(r"[a-z0-9][a-z0-9'\-]*")

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "by", "with",
    "from", "at", "as", "is", "are", "was", "were", "be", "been", "has", "have",
    "had", "will", "would", "could", "should", "can", "its", "it's", "that",
    "this", "these", "those", "their", "there", "they", "them", "his", "her",
    "he", "she", "we", "our", "you", "your", "i", "me", "my", "but", "not",
    "no", "if", "so", "than", "then", "when", "where", "who", "what", "how",
    "why", "news", "world", "said", "says", "say", "new",
}


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [tok for tok in _TOKEN_PAT.findall(text.lower()) if len(tok) > 1 and tok not in _STOPWORDS]


def _bucket(key: str) -> int:
    # crc32 is stable across processes/workers (unlike Python's built-in hash()
    # which uses PYTHONHASHSEED and differs per interpreter start).
    return zlib.crc32(key.encode("utf-8")) % _DIM


def _embed_one(text: str) -> np.ndarray:
    vec = np.zeros(_DIM, dtype=np.float32)
    tokens = _tokenize(text)
    if not tokens:
        return vec

    # Unigram counts
    for tok in tokens:
        vec[_bucket(tok)] += 1.0

    # Bigrams at half weight — gives "climate change" real signal as a phrase,
    # not just two independent unigrams.
    for a, b in zip(tokens, tokens[1:]):
        vec[_bucket(f"{a}_{b}")] += 0.5

    # L2-normalize so cosine similarity reduces to a dot product.
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec


async def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed a batch of texts into a (len(texts), _DIM) float32 matrix.

    Returns an empty (0, _DIM) array for empty input so callers can rely on
    `.shape[1]` being well-defined.
    """
    if not texts:
        return np.zeros((0, _DIM), dtype=np.float32)

    vectors = np.stack([_embed_one(t) for t in texts], axis=0)
    logger.info("embedded %d texts locally (dim=%d)", len(texts), _DIM)
    return vectors


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.size == 0 or b.size == 0:
        return np.zeros(
            (a.shape[0] if a.ndim > 1 else 0, b.shape[0] if b.ndim > 1 else 0),
            dtype=np.float32,
        )
    a_norms = np.linalg.norm(a, axis=1, keepdims=True)
    b_norms = np.linalg.norm(b, axis=1, keepdims=True)
    a_norm = a / np.where(a_norms == 0, 1.0, a_norms)
    b_norm = b / np.where(b_norms == 0, 1.0, b_norms)
    return a_norm @ b_norm.T
