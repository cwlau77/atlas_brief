import pytest

from backend.focus_terms import keyword_hit
from backend.processing.embeddings import embed_texts
from backend.processing.relevance import filter_by_relevance
from backend.tests.fixtures.relevance_pairs import LABELED


def test_keyword_hit_respects_word_boundaries():
    # Substring matching used to false-positive on these.
    assert not keyword_hit("copenhagen fashion week opens", ["cop"])
    assert not keyword_hit("southampton win promotion", ["south"])
    assert not keyword_hit("actor trades quips at premiere", ["trade"])
    # Word and phrase matches still hit.
    assert keyword_hit("net zero pledges announced", ["net zero"])
    assert keyword_hit("tariffs rise on imports", ["tariffs"])
    assert keyword_hit("South Asia summit convenes", ["south"])


@pytest.mark.asyncio
async def test_labeled_pairs_precision_recall(make_article):
    by_focus: dict[str, list[tuple]] = {}
    for focus, title, snippet, label in LABELED:
        by_focus.setdefault(focus, []).append((title, snippet, label))

    tp = fp = fn = tn = 0
    for focus, rows in by_focus.items():
        arts = [make_article(title=t, snippet=s, url=f"https://x.com/{focus}/{i}")
                for i, (t, s, _) in enumerate(rows)]
        emb = await embed_texts([f"{a.title}. {a.snippet}" for a in arts])
        kept, _ = await filter_by_relevance(focus, arts, emb)
        kept_titles = {a.title for a in kept}
        for (t, _, label) in rows:
            hit = t in kept_titles
            tp += hit and label
            fp += hit and not label
            fn += (not hit) and label
            tn += (not hit) and (not label)

    recall = tp / (tp + fn)
    precision = tp / (tp + fp)
    assert recall >= 0.85, f"recall {recall:.2f} too low (tp={tp}, fn={fn})"
    assert precision >= 0.75, f"precision {precision:.2f} too low (tp={tp}, fp={fp})"
