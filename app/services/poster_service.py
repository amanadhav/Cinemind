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
TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280"

# Returned when no poster can be found (or no API key is configured).
PLACEHOLDER_POSTER_URL = (
    "https://via.placeholder.com/500x750.png?text=No+Poster+Available"
)

# Network timeout for TMDB requests, in seconds.
_REQUEST_TIMEOUT = 8

# In-memory cache: {movie_title: poster_url}. Persists for the process
# lifetime so repeated lookups of the same title don't re-hit the API.
_poster_cache = {}

# In-memory cache for full movie-detail payloads, keyed by title.
_details_cache = {}


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
    the first result's poster. Falls back to a generated placeholder image
    (showing the movie's initial) when the title is not found, the API key is
    missing, or the request fails.

    Results are cached in-memory keyed by the original ``title``.
    """
    if title in _poster_cache:
        return _poster_cache[title]

    poster_url = _fetch_poster_url(title)
    _poster_cache[title] = poster_url
    return poster_url


def placeholder_for(title):
    """Build a gray placeholder URL displaying the movie's initial."""
    clean = _clean_title(title)
    initial = clean[0].upper() if clean else "?"
    return f"https://placehold.co/300x450/27272a/a1a1aa.png?text={initial}"


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
    _details_cache.clear()


def get_movie_details(title):
    """Return rich TMDB metadata for ``title`` (cached).

    Performs a TMDB title search to resolve the movie's TMDB id, then fetches
    the full movie record for overview, runtime, tagline, genres, and a
    backdrop image. Falls back to a minimal payload (built from the supplied
    title plus a placeholder poster) when the API key is missing, the title
    cannot be matched, or the request fails.

    Returns a dict with keys: ``title``, ``year``, ``genres`` (list),
    ``overview``, ``runtime``, ``tagline``, ``poster_url``, ``backdrop_url``.
    """
    if title in _details_cache:
        return _details_cache[title]

    details = _fetch_movie_details(title)
    _details_cache[title] = details
    return details


def _fallback_details(title):
    """Minimal detail payload used when TMDB is unavailable."""
    return {
        "title": _clean_title(title),
        "year": None,
        "genres": [],
        "overview": "",
        "runtime": None,
        "tagline": "",
        "poster_url": get_poster_url(title),
        "backdrop_url": None,
    }


def _fetch_movie_details(title):
    """Resolve ``title`` to a TMDB id and fetch the full movie record."""
    api_key = os.environ.get("TMDB_API_KEY")
    if not api_key:
        return _fallback_details(title)

    try:
        search = requests.get(
            TMDB_SEARCH_URL,
            params={"api_key": api_key, "query": _clean_title(title)},
            timeout=_REQUEST_TIMEOUT,
        )
        search.raise_for_status()
        results = search.json().get("results", [])
        if not results:
            return _fallback_details(title)

        tmdb_id = results[0].get("id")
        detail = requests.get(
            TMDB_MOVIE_URL.format(tmdb_id=tmdb_id),
            params={"api_key": api_key},
            timeout=_REQUEST_TIMEOUT,
        )
        detail.raise_for_status()
        data = detail.json()
    except (requests.RequestException, ValueError, KeyError):
        return _fallback_details(title)

    poster_path = data.get("poster_path")
    backdrop_path = data.get("backdrop_path")
    release_date = data.get("release_date") or ""

    return {
        "title": data.get("title") or _clean_title(title),
        "year": release_date[:4] if release_date else None,
        "genres": [g["name"] for g in data.get("genres", [])],
        "overview": data.get("overview") or "",
        "runtime": data.get("runtime"),
        "tagline": data.get("tagline") or "",
        "poster_url": (
            f"{TMDB_IMAGE_BASE_URL}{poster_path}"
            if poster_path
            else get_poster_url(title)
        ),
        "backdrop_url": (
            f"{TMDB_BACKDROP_BASE_URL}{backdrop_path}" if backdrop_path else None
        ),
    }
