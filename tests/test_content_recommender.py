"""Tests for the content-based recommender service."""
from app.services import content_recommender as cr


def test_recommend_returns_list_of_ten():
    """recommend() returns a list of 10 items for a known movie."""
    result = cr.recommend("Inception")
    assert isinstance(result, list)
    assert len(result) == 10
    assert all(isinstance(title, str) for title in result)


def test_recommend_includes_query_movie_first():
    """The queried movie itself is the first recommendation."""
    result = cr.recommend("Inception")
    assert result[0].lower() == "inception"


def test_fuzzy_matching_finds_inception():
    """A partial query like 'incept' resolves to 'Inception'."""
    result = cr.recommend("incept")
    assert isinstance(result, list)
    assert result[0].lower() == "inception"


def test_unknown_movie_returns_error_string():
    """An unknown movie returns the not-found message rather than a list."""
    result = cr.recommend("zzzz this is not a real movie 9999")
    assert not isinstance(result, list)
    assert result == "opps! movie not found in our database"


def test_recommend_respects_n_results():
    """The n_results argument controls the number of returned items."""
    result = cr.recommend("Inception", n_results=5)
    assert isinstance(result, list)
    assert len(result) == 5


def test_get_model_is_cached_singleton():
    """get_model() returns the same cached artifacts across calls."""
    data1, model1, matrix1 = cr.get_model()
    data2, model2, matrix2 = cr.get_model()
    assert data1 is data2
    assert model1 is model2
    assert matrix1 is matrix2
    assert cr.is_model_loaded() is True


def test_search_titles_matches_query():
    """search_titles() returns up to `limit` titles containing the query."""
    results = cr.search_titles("inc", limit=10)
    assert isinstance(results, list)
    assert len(results) <= 10
    assert all("inc" in title.lower() for title in results)


def test_search_titles_empty_query_returns_empty():
    """An empty query yields an empty list."""
    assert cr.search_titles("") == []
    assert cr.search_titles("   ") == []
