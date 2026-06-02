"""Tests for the TMDB poster service (network calls are mocked)."""
from unittest.mock import MagicMock, patch

import pytest

from app.services import poster_service as ps


@pytest.fixture(autouse=True)
def clear_poster_cache():
    """Ensure each test starts with an empty cache."""
    ps.clear_cache()
    yield
    ps.clear_cache()


def _mock_response(json_payload):
    resp = MagicMock()
    resp.raise_for_status.return_value = None
    resp.json.return_value = json_payload
    return resp


def test_successful_lookup_builds_full_poster_url(monkeypatch):
    """A successful TMDB hit yields the full w500 image URL."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    resp = _mock_response({"results": [{"poster_path": "/abc123.jpg"}]})
    with patch.object(ps.requests, "get", return_value=resp):
        url = ps.get_poster_url("Inception")
    assert url == "https://image.tmdb.org/t/p/w500/abc123.jpg"


def test_caching_calls_api_only_once(monkeypatch):
    """Repeated lookups of the same title hit the API only once."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    resp = _mock_response({"results": [{"poster_path": "/abc123.jpg"}]})
    with patch.object(ps.requests, "get", return_value=resp) as mock_get:
        first = ps.get_poster_url("Inception")
        second = ps.get_poster_url("Inception")
        third = ps.get_poster_url("Inception")
    assert first == second == third
    assert mock_get.call_count == 1


def test_distinct_titles_each_call_api(monkeypatch):
    """Different titles each trigger their own API call."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    resp = _mock_response({"results": [{"poster_path": "/x.jpg"}]})
    with patch.object(ps.requests, "get", return_value=resp) as mock_get:
        ps.get_poster_url("Inception")
        ps.get_poster_url("Avatar")
    assert mock_get.call_count == 2


def test_missing_api_key_returns_placeholder(monkeypatch):
    """With no API key, the placeholder is returned without calling the API."""
    monkeypatch.delenv("TMDB_API_KEY", raising=False)
    with patch.object(ps.requests, "get") as mock_get:
        url = ps.get_poster_url("Inception")
    assert url == ps.placeholder_for("Inception")
    mock_get.assert_not_called()


def test_no_results_returns_placeholder(monkeypatch):
    """An empty TMDB result set falls back to the placeholder."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    resp = _mock_response({"results": []})
    with patch.object(ps.requests, "get", return_value=resp):
        url = ps.get_poster_url("zzzz-not-a-movie")
    assert url == ps.placeholder_for("zzzz-not-a-movie")


def test_request_exception_returns_placeholder(monkeypatch):
    """Network errors fall back to the placeholder."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    with patch.object(
        ps.requests, "get", side_effect=ps.requests.RequestException("boom")
    ):
        url = ps.get_poster_url("Inception")
    assert url == ps.placeholder_for("Inception")


def test_year_suffix_stripped_from_query(monkeypatch):
    """A trailing (YYYY) is stripped from the TMDB query string."""
    monkeypatch.setenv("TMDB_API_KEY", "fake-key")
    resp = _mock_response({"results": [{"poster_path": "/x.jpg"}]})
    with patch.object(ps.requests, "get", return_value=resp) as mock_get:
        ps.get_poster_url("Shawshank Redemption, The (1994)")
    sent_query = mock_get.call_args.kwargs["params"]["query"]
    assert sent_query == "Shawshank Redemption, The"
