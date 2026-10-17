from backend.focus_terms import distinctive_tokens, extract_focus_terms, topic_heads


def test_extract_expands_known_aliases():
    terms = extract_focus_terms("climate")
    assert "climate" in terms
    assert "climate change" in terms
    assert "net zero" in terms


def test_extract_strips_stopwords_and_orders_specific_first():
    terms = extract_focus_terms("the migration of people")
    assert terms[0] == "migration people"  # full normalized phrase first (longest)
    assert "migration" in terms
    assert "the" not in terms


def test_distinctive_tokens_split_entities_from_generic_words():
    # "regeneron" is a near-unique proper noun; matching on it alone is safe.
    assert distinctive_tokens("Regeneron Pharmaceuticals") == {"regeneron"}
    # "streamer" is uncommon in general English but ubiquitous *within*
    # entertainment journalism — NOT safe to trust alone (this was the
    # Kai Cenat "Streamer University" bug: it let in any article mentioning
    # any streamer). Neither token here clears the conservative bar.
    assert distinctive_tokens("Streamer University") == set()
    # Topic focuses made entirely of common words have no distinctive anchor.
    assert distinctive_tokens("south asian security") == set()
    assert distinctive_tokens("climate") == set()


def test_topic_heads_identifies_curated_broad_topics():
    assert topic_heads("south asian security") == {"security"}
    assert topic_heads("climate") == {"climate"}
    # Entity/event names are not curated topics, regardless of word rarity.
    assert topic_heads("Regeneron Pharmaceuticals") == set()
    assert topic_heads("Streamer University") == set()


def test_pronoun_us_is_a_stopword():
    assert "us" not in extract_focus_terms("Data centers and privacy in the US")
