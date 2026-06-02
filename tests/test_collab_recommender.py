"""Tests for the real-time SVD collaborative recommender."""
from app.services import collab_recommender as cr


def test_model_trains_and_caches():
    m1 = cr.get_model()
    m2 = cr.get_model()
    assert m1 is m2
    assert cr.is_model_loaded() is True


def test_known_user_recommendation_disabled():
    """Known-user recs are intentionally disabled with the compact model.

    The deployed model stores only item factors (not per-user factors), so
    ``recommend_for_user`` returns an empty list. The product uses the
    cold-start fold-in flow instead.
    """
    recs = cr.recommend_for_user(42, n=10)
    assert recs == []


def test_cold_start_excludes_provided_ratings():
    provided = [
        {"movie_id": 1, "rating": 5.0},
        {"movie_id": 3, "rating": 2.0},
        {"movie_id": 6, "rating": 4.5},
    ]
    recs = cr.recommend_for_new_user(provided, n=10)
    assert 0 < len(recs) <= 10
    rec_ids = {r["movie_id"] for r in recs}
    assert rec_ids.isdisjoint({1, 3, 6})


def test_cold_start_empty_returns_empty():
    assert cr.recommend_for_new_user([], n=10) == []


def test_cold_start_ignores_unknown_movie_ids():
    """Unknown movie IDs are skipped; valid ones still drive the result."""
    recs = cr.recommend_for_new_user(
        [{"movie_id": 999999, "rating": 5.0}, {"movie_id": 1, "rating": 5.0}],
        n=5,
    )
    assert isinstance(recs, list)
    assert len(recs) <= 5


def test_similar_taste_returns_related_movie():
    """Rating animated family films highly should surface similar films.

    The cold-start fold-in needs a few ratings to form a reliable taste
    signal (the product flow requires >=5), so this mirrors that scenario.
    """
    provided = [
        {"movie_id": 1, "rating": 5.0},      # Toy Story
        {"movie_id": 34, "rating": 5.0},     # Babe
        {"movie_id": 158, "rating": 4.5},    # Casper
        {"movie_id": 364, "rating": 5.0},    # The Lion King
        {"movie_id": 588, "rating": 5.0},    # Aladdin
    ]
    recs = cr.recommend_for_new_user(provided, n=10)
    titles = " ".join(r["title"].lower() for r in recs)
    assert any(
        kw in titles
        for kw in ("toy story 2", "shrek", "bug", "monsters", "beauty", "nemo")
    )


def test_popular_movies_shape():
    movies = cr.popular_movies(n=20)
    assert len(movies) == 20
    for item in movies:
        assert {"movie_id", "title", "genres"} <= set(item)


def test_valid_user_id_range():
    assert cr.is_valid_user_id(1) is True
    assert cr.is_valid_user_id(610) is True
    assert cr.is_valid_user_id(0) is False
    # ML-25M has 162,541 users, so IDs well above the old 610 bound are valid.
    assert cr.is_valid_user_id(162541) is True
    assert cr.is_valid_user_id(162542) is False
    assert cr.is_valid_user_id("42") is False
