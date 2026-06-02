"""Tests for request validation, the error envelope, and request tracing.

These cover the production-hardening layer added on top of the routes:
Pydantic-backed validation (rating/user bounds, query limits), the consistent
``{"error", "type"}`` JSON error envelope, and the ``X-Request-ID`` header.
"""
import pytest


# ---------------------------------------------------------------------------
# Error envelope + request tracing
# ---------------------------------------------------------------------------
def test_validation_error_envelope_shape(client):
    """A 400 carries both a message and a machine-readable type."""
    resp = client.post("/api/recommend/content", json={})
    assert resp.status_code == 400
    body = resp.get_json()
    assert set(body.keys()) == {"error", "type"}
    assert body["type"] == "validation_error"


def test_request_id_header_present(client):
    resp = client.get("/health")
    assert "X-Request-ID" in resp.headers
    assert resp.headers["X-Request-ID"] != "-"


def test_unknown_route_returns_json_404(client):
    resp = client.get("/api/does-not-exist")
    assert resp.status_code == 404
    body = resp.get_json()
    assert body["type"] == "http_error"


# ---------------------------------------------------------------------------
# Rating bounds (MovieLens half-star scale 0.5..5.0)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("bad_rating", [0, 0.4, 5.5, 10, -1])
def test_rate_rejects_out_of_range_rating(client, bad_rating):
    resp = client.post(
        "/api/rate", json={"ratings": [{"movie_id": 1, "rating": bad_rating}]}
    )
    assert resp.status_code == 400
    assert resp.get_json()["type"] == "validation_error"


@pytest.mark.parametrize("good_rating", [0.5, 2.5, 5.0])
def test_rate_accepts_in_range_rating(client, good_rating):
    resp = client.post(
        "/api/rate", json={"ratings": [{"movie_id": 1, "rating": good_rating}]}
    )
    assert resp.status_code == 200


def test_rate_rejects_non_positive_movie_id(client):
    resp = client.post(
        "/api/rate", json={"ratings": [{"movie_id": 0, "rating": 4.0}]}
    )
    assert resp.status_code == 400


def test_rate_rejects_too_many_ratings(client):
    ratings = [{"movie_id": i, "rating": 4.0} for i in range(1, 250)]
    resp = client.post("/api/rate", json={"ratings": ratings})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Content / hybrid string validation
# ---------------------------------------------------------------------------
def test_content_rejects_blank_movie(client):
    resp = client.post("/api/recommend/content", json={"movie": "   "})
    assert resp.status_code == 400
    assert resp.get_json()["type"] == "validation_error"


def test_content_rejects_overlong_movie(client):
    resp = client.post("/api/recommend/content", json={"movie": "x" * 500})
    assert resp.status_code == 400


def test_hybrid_rejects_empty_ratings_list(client):
    resp = client.post(
        "/api/recommend/hybrid", json={"movie": "Inception", "ratings": []}
    )
    assert resp.status_code == 400


def test_hybrid_accepts_ratings_signal(client):
    resp = client.post(
        "/api/recommend/hybrid",
        json={
            "movie": "Inception",
            "ratings": [
                {"movie_id": 1, "rating": 5.0},
                {"movie_id": 3, "rating": 2.0},
                {"movie_id": 6, "rating": 4.5},
            ],
        },
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Collaborative user-id bounds via the schema
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("bad_user", [0, 162542, -1])
def test_collaborative_rejects_out_of_range_user(client, bad_user):
    resp = client.post("/api/recommend/collaborative", json={"user_id": bad_user})
    assert resp.status_code == 400
    assert resp.get_json()["type"] == "validation_error"
