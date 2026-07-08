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
async def test_entity_focus_rejects_generic_category_noise(make_article):
    """User-reported: 'Regeneron Pharmaceuticals' returned mostly articles that
    merely contained the word 'pharmaceuticals'. A generic-token-only hit must
    not pass when the focus has a distinctive anchor token."""
    focus = "Regeneron Pharmaceuticals"
    relevant = [
        make_article(title="Regeneron Pharmaceuticals beats quarterly earnings expectations",
                     snippet="The biotech raised full-year guidance.", url="https://x.com/r/1"),
        make_article(title="Regeneron wins FDA approval for new eye therapy",
                     snippet="Approval covers a common retinal condition.", url="https://x.com/r/2"),
    ]
    noise = [
        make_article(title="Sanofi expands pharmaceuticals plant in northern France",
                     snippet="The site will produce vaccines for European markets.", url="https://x.com/n/1"),
        make_article(title="Pharmaceuticals sector faces pricing pressure in Congress",
                     snippet="Lawmakers debate negotiation powers over drug costs.", url="https://x.com/n/2"),
        make_article(title="Generic pharmaceuticals imports rise across Latin America",
                     snippet="Distributors cite currency swings and demand growth.", url="https://x.com/n/3"),
        make_article(title="Indian pharmaceuticals exporters court African buyers",
                     snippet="Trade delegations tour manufacturing hubs this week.", url="https://x.com/n/4"),
        make_article(title="Counterfeit pharmaceuticals seized at Rotterdam port",
                     snippet="Customs officials describe a record haul of fake pills.", url="https://x.com/n/5"),
        make_article(title="Pharmaceuticals lobby spends record sums on advertising",
                     snippet="Watchdog groups tally television and digital campaigns.", url="https://x.com/n/6"),
    ]
    arts = relevant + noise
    emb = await embed_texts([f"{a.title}. {a.snippet}" for a in arts])
    kept, _ = await filter_by_relevance(focus, arts, emb)
    kept_titles = {a.title for a in kept}
    for a in relevant:
        assert a.title in kept_titles, f"relevant article dropped: {a.title}"
    leaked = [a.title for a in noise if a.title in kept_titles]
    assert not leaked, f"generic pharma noise leaked through: {leaked}"


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
