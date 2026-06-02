"""Tests for the JSON API routes."""
from unittest.mock import patch

import pytest

# Patch the poster lookups in every module that imported the function so no
# real TMDB requests are made during route tests.
_POSTER_TARGETS = (
    "app.routes.recommend.get_poster_url",
    "app.routes.ratings.get_poster_url",
)


@pytest.fixture(autouse=True)
def stub_posters():
    patchers = [patch(target, return_value="http://poster/x.jpg") for target in _POSTER_TARGETS]
    for p in patchers:
        p.start()
    yield
    for p in patchers:
        p.stop()


# ---------------------------------------------------------------------------
# /api/recommend/content
# ---------------------------------------------------------------------------
def test_content_endpoint_returns_200_and_shape(client):
    resp = client.post("/api/recommend/content", json={"movie": "Inception"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) == 10
    for item in data:
        assert set(item.keys()) == {"title", "poster_url"}


def test_content_endpoint_missing_movie_returns_400(client):
    resp = client.post("/api/recommend/content", json={})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_content_endpoint_unknown_movie_returns_404(client):
    resp = client.post(
        "/api/recommend/content", json={"movie": "zzzz not a real movie 9999"}
    )
    assert resp.status_code == 404
    assert "error" in resp.get_json()


# ---------------------------------------------------------------------------
# /api/recommend/collaborative  (real-time SVD)
# ---------------------------------------------------------------------------
def test_collaborative_endpoint_valid_user(client):
    """The known-user endpoint is disabled with the compact model.

    It responds 200 with an empty recommendations list (the product uses the
    cold-start /api/rate flow instead).
    """
    resp = client.post("/api/recommend/collaborative", json={"user_id": 42})
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data.keys()) == {"recommendations"}
    assert data["recommendations"] == []


def test_collaborative_endpoint_accepts_valid_id(client):
    """A valid user id is accepted (200) even though recs are empty."""
    resp = client.post("/api/recommend/collaborative", json={"user_id": 1})
    assert resp.status_code == 200


@pytest.mark.parametrize("user_id", [1, 610, 162541])
def test_collaborative_endpoint_boundaries_valid(client, user_id):
    resp = client.post("/api/recommend/collaborative", json={"user_id": user_id})
    assert resp.status_code == 200


@pytest.mark.parametrize("user_id", [0, 162542, 200000, -5])
def test_collaborative_endpoint_out_of_range(client, user_id):
    resp = client.post("/api/recommend/collaborative", json={"user_id": user_id})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


@pytest.mark.parametrize("user_id", ["abc", None])
def test_collaborative_endpoint_non_integer(client, user_id):
    resp = client.post("/api/recommend/collaborative", json={"user_id": user_id})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


# ---------------------------------------------------------------------------
# /api/rate  (cold-start fold-in)
# ---------------------------------------------------------------------------
def test_rate_endpoint_returns_recommendations(client):
    body = {
        "ratings": [
            {"movie_id": 1, "rating": 5.0},
            {"movie_id": 3, "rating": 2.0},
            {"movie_id": 6, "rating": 4.5},
        ]
    }
    resp = client.post("/api/rate", json=body)
    assert resp.status_code == 200
    recs = resp.get_json()["recommendations"]
    assert 0 < len(recs) <= 10
    rated_ids = {1, 3, 6}
    for item in recs:
        assert {"movie_id", "title", "poster_url", "genres", "score"} <= set(item)
        assert item["movie_id"] not in rated_ids


def test_rate_endpoint_empty_ratings_returns_400(client):
    resp = client.post("/api/rate", json={"ratings": []})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_rate_endpoint_missing_field_returns_400(client):
    resp = client.post("/api/rate", json={})
    assert resp.status_code == 400


def test_rate_endpoint_invalid_entries_returns_400(client):
    resp = client.post("/api/rate", json={"ratings": [{"foo": "bar"}]})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /api/movies/popular
# ---------------------------------------------------------------------------
def test_popular_movies_default(client):
    resp = client.get("/api/movies/popular")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) == 20
    for item in data:
        assert {"movie_id", "title", "genres", "poster_url"} <= set(item)


def test_popular_movies_respects_limit(client):
    resp = client.get("/api/movies/popular?limit=5")
    assert resp.status_code == 200
    assert len(resp.get_json()) == 5


# ---------------------------------------------------------------------------
# /api/movies/search
# ---------------------------------------------------------------------------
def test_search_movies_returns_rateable_objects(client):
    resp = client.get("/api/movies/search?q=matrix&limit=5")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert 0 < len(data) <= 5
    for item in data:
        assert {"movie_id", "title", "genres", "poster_url"} <= set(item)
        assert isinstance(item["movie_id"], int)
        assert "matrix" in item["title"].lower()


def test_search_movies_empty_query_returns_empty(client):
    resp = client.get("/api/movies/search?q=")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_search_movies_respects_limit(client):
    resp = client.get("/api/movies/search?q=the&limit=3")
    assert resp.status_code == 200
    assert len(resp.get_json()) <= 3


# ---------------------------------------------------------------------------
# /api/movies/explore
# ---------------------------------------------------------------------------
def test_explore_splits_matches_and_similar(client):
    resp = client.get("/api/movies/explore?q=toy story")
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data.keys()) == {"matches", "similar"}
    # "Toy Story" should surface the franchise in matches.
    match_titles = " ".join(m["title"].lower() for m in data["matches"])
    assert "toy story" in match_titles
    # Each item in both sections is a rateable movie object.
    for item in data["matches"] + data["similar"]:
        assert {"movie_id", "title", "genres", "poster_url"} <= set(item)
        assert isinstance(item["movie_id"], int)


def test_explore_dedupes_matches_from_similar(client):
    resp = client.get("/api/movies/explore?q=toy story")
    data = resp.get_json()
    match_ids = {m["movie_id"] for m in data["matches"]}
    similar_ids = {m["movie_id"] for m in data["similar"]}
    assert match_ids.isdisjoint(similar_ids)


def test_explore_empty_query(client):
    resp = client.get("/api/movies/explore?q=")
    assert resp.status_code == 200
    assert resp.get_json() == {"matches": [], "similar": []}


# ---------------------------------------------------------------------------
# /api/recommend/hybrid
# ---------------------------------------------------------------------------
def test_hybrid_endpoint_returns_blend(client):
    resp = client.post(
        "/api/recommend/hybrid", json={"movie": "Inception", "user_id": 42}
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) <= 10
    for item in data:
        assert set(item.keys()) == {"title", "poster_url", "source"}
        assert item["source"] in {"content", "collaborative", "both"}


def test_hybrid_endpoint_missing_fields(client):
    resp = client.post("/api/recommend/hybrid", json={"user_id": 42})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /api/search
# ---------------------------------------------------------------------------
def test_search_endpoint_returns_matches(client):
    resp = client.get("/api/search?q=inc")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) <= 10
    assert all("inc" in title.lower() for title in data)


def test_search_endpoint_empty_query(client):
    resp = client.get("/api/search?q=")
    assert resp.status_code == 200
    assert resp.get_json() == []


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------
def test_health_returns_ok(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "ok"
    assert "model_loaded" in data
    assert isinstance(data["model_loaded"], bool)
