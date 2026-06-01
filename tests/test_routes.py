"""Tests for the JSON API routes."""
from unittest.mock import patch

import pytest

# Patch the poster lookups in every module that imported the function so no
# real TMDB requests are made during route tests.
_POSTER_TARGETS = (
    "app.routes.content_based.get_poster_url",
    "app.routes.collaborative.get_poster_url",
    "app.routes.api.get_poster_url",
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
# /api/recommend/collaborative
# ---------------------------------------------------------------------------
def test_collaborative_endpoint_valid_user(client):
    resp = client.post("/api/recommend/collaborative", json={"user_id": 42})
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data.keys()) == {"knn_results", "matrix_results"}
    assert len(data["knn_results"]) == 10
    assert len(data["matrix_results"]) == 10
    for item in data["knn_results"] + data["matrix_results"]:
        assert set(item.keys()) == {"title", "poster_url"}


@pytest.mark.parametrize("user_id", [1, 610])
def test_collaborative_endpoint_boundaries_valid(client, user_id):
    resp = client.post("/api/recommend/collaborative", json={"user_id": user_id})
    assert resp.status_code == 200


@pytest.mark.parametrize("user_id", [0, 611, 700, -5])
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
