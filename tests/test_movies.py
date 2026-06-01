"""Tests for the movie detail endpoint (TMDB calls are stubbed)."""
from unittest.mock import patch

import pytest

# Movie id 1 is "Toy Story (1995)" in the MovieLens catalog.
_DETAILS = {
    "title": "Toy Story",
    "year": "1995",
    "genres": ["Animation", "Comedy", "Family"],
    "overview": "A cowboy doll is profoundly threatened...",
    "runtime": 81,
    "tagline": "The adventure takes off!",
    "poster_url": "http://poster/toy.jpg",
    "backdrop_url": "http://backdrop/toy.jpg",
}


@pytest.fixture(autouse=True)
def stub_details():
    with patch(
        "app.routes.movies.get_movie_details", return_value=dict(_DETAILS)
    ) as m:
        yield m


def test_movie_detail_returns_full_shape(client):
    resp = client.get("/api/movie/1")
    assert resp.status_code == 200
    data = resp.get_json()
    expected = {
        "movie_id",
        "title",
        "year",
        "genres",
        "overview",
        "runtime",
        "tagline",
        "poster_url",
        "backdrop_url",
    }
    assert expected <= set(data.keys())
    assert data["movie_id"] == 1
    assert data["title"] == "Toy Story"
    assert isinstance(data["genres"], list)


def test_movie_detail_unknown_id_returns_404(client):
    resp = client.get("/api/movie/99999999")
    assert resp.status_code == 404
    assert "error" in resp.get_json()


def test_movie_detail_falls_back_to_catalog_genres(client, stub_details):
    """If TMDB returns no genres, the local catalog genres are used."""
    stub_details.return_value = {**_DETAILS, "genres": []}
    resp = client.get("/api/movie/1")
    assert resp.status_code == 200
    # Toy Story's MovieLens genres include Animation/Children/Comedy.
    assert len(resp.get_json()["genres"]) > 0
