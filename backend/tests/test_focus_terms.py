from backend.focus_terms import build_boolean_query, distinctive_tokens, extract_focus_terms


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


def test_boolean_query_quotes_and_ors():
    q = build_boolean_query("trade")
    assert q.startswith("(") and " OR " in q and '"tariffs"' in q


def test_boolean_query_always_includes_the_focus_phrase_itself():
    # Regression guard: length-sorted aliases used to crowd the focus term out
    # of the max_terms window, so upstream queries for "trade" never searched
    # for "trade" and queries for "climate" never searched for "climate".
    assert '"trade"' in build_boolean_query("trade")
    assert '"climate"' in build_boolean_query("climate")
    assert '"south asian security"' in build_boolean_query("South Asian security")


def test_distinctive_tokens_split_entities_from_generic_words():
    # "regeneron" is a proper noun absent from everyday English;
    # "pharmaceuticals" is an ordinary dictionary word that matches thousands
    # of unrelated articles.
    assert distinctive_tokens("Regeneron Pharmaceuticals") == {"regeneron"}
    assert distinctive_tokens("Streamer University") == {"streamer"}
    # Topic focuses made entirely of common words have no distinctive anchor.
    assert distinctive_tokens("south asian security") == set()
    assert distinctive_tokens("climate") == set()


def test_entity_query_drops_generic_bare_tokens_upstream():
    q = build_boolean_query("Regeneron Pharmaceuticals")
    assert '"regeneron pharmaceuticals"' in q
    assert '"regeneron"' in q
    # The generic token must not be OR'd on its own — it floods the per-source
    # article cap with category noise before relevance filtering can run.
    assert q.replace('"regeneron pharmaceuticals"', '').count("pharmaceuticals") == 0


def test_multiword_topic_query_keeps_phrase_and_aliases_not_bare_tokens():
    q = build_boolean_query("south asian security")
    assert '"south asian security"' in q
    assert '"military"' in q  # alias expansion of the known topic token
    assert '"asian"' not in q  # bare generic tokens dropped upstream
