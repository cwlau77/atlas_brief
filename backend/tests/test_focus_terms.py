from backend.focus_terms import build_boolean_query, extract_focus_terms


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
