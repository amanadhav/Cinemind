"""Poster image fetching via the TMDB API.

Replaces the previous BeautifulSoup IMDb scraper. Given a movie title, this
queries the TMDB search endpoint, takes the ``poster_path`` from the first
result, and builds a full image URL. Results (including misses) are cached
in-memory for the lifetime of the process so the same title is only fetched
from TMDB once per session.

The TMDB API key is read from the ``TMDB_API_KEY`` environment variable and
is never hardcoded.
"""
import os
import re

import requests

# TMDB endpoints.
TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

# Returned when no poster can be found (or no API key is configured).
PLACEHOLDER_POSTER_URL = (
    "https://via.placeholder.com/500x750.png?text=No+Poster+Available"
)

# Network timeout for TMDB requests, in seconds.
_REQUEST_TIMEOUT = 8

# In-memory cache: {movie_title: poster_url}. Persists for the process
# lifetime so repeated lookups of the same title don't re-hit the API.
_poster_cache = {}


def _clean_title(title):
    """Strip a trailing ``(YYYY)`` year suffix to improve TMDB match rate.

    The precomputed collaborative datasets store titles like
    ``"Shawshank Redemption, The (1994)"``; removing the year gives TMDB a
    cleaner query. The original title is still used as the cache key.
    """
    return re.sub(r"\s*\(\d{4}\)\s*$", "", str(title)).strip()


def get_poster_url(title):
    """Return a poster image URL for ``title``.

    Looks the title up via the TMDB search API and returns the full URL of
    the first result's poster. Falls back to a placeholder image when the
    title is not found, the API key is missing, or the request fails.

    Results are cached in-memory keyed by the original ``title``.
    """
    if title in _poster_cache:
        return _poster_cache[title]

    poster_url = _fetch_poster_url(title)
    _poster_cache[title] = poster_url
    return poster_url


def _fetch_poster_url(title):
    """Perform the actual TMDB lookup for ``title`` (uncached)."""
    api_key = os.environ.get("TMDB_API_KEY")
    if not api_key:
        return PLACEHOLDER_POSTER_URL

    params = {"api_key": api_key, "query": _clean_title(title)}
    try:
        response = requests.get(
            TMDB_SEARCH_URL, params=params, timeout=_REQUEST_TIMEOUT
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    except (requests.RequestException, ValueError):
        return PLACEHOLDER_POSTER_URL

    if results:
        poster_path = results[0].get("poster_path")
        if poster_path:
            return f"{TMDB_IMAGE_BASE_URL}{poster_path}"

    return PLACEHOLDER_POSTER_URL


def clear_cache():
    """Clear the in-memory poster cache (primarily for tests)."""
    _poster_cache.clear()
