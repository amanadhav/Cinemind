"""Cold-start rating flow: rate a few movies, get personalized picks."""
import logging

from flask import Blueprint, jsonify, request

from app.schemas import RateRequest, validate
from app.services import collab_recommender as collab
from app.services.content_recommender import recommend as content_recommend
from app.services.poster_service import get_poster_url

logger = logging.getLogger(__name__)

ratings_bp = Blueprint("ratings", __name__)


@ratings_bp.route("/api/movies/popular", methods=["GET"])
def api_popular_movies():
    """Return popular movies (by rating count) to seed the rating UI.

    Query string: ``?limit=20`` (default 20, capped at 50).
    Response: ``[{"movie_id", "title", "genres", "poster_url"}, ...]``
    """
    try:
        limit = int(request.args.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(limit, 50))

    movies = collab.popular_movies(n=limit)
    for item in movies:
        item["poster_url"] = get_poster_url(item["title"])
    return jsonify(movies), 200


@ratings_bp.route("/api/movies/search", methods=["GET"])
def api_search_movies():
    """Search rateable movies by title to extend the rating UI beyond popular.

    Query string: ``?q=matrix&limit=8`` (limit default 8, capped at 20).
    Response: ``[{"movie_id", "title", "genres", "poster_url"}, ...]``.

    Unlike ``/api/search`` (which returns plain title strings for the
    content-based autocomplete), this returns full objects with ``movie_id``
    so selected movies can be rated and folded into the SVD cold-start.
    """
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([]), 200

    try:
        limit = int(request.args.get("limit", 8))
    except (TypeError, ValueError):
        limit = 8
    limit = max(1, min(limit, 20))

    movies = collab.search_movies(query, limit=limit)
    for item in movies:
        item["poster_url"] = get_poster_url(item["title"])
    return jsonify(movies), 200


@ratings_bp.route("/api/movies/explore", methods=["GET"])
def api_explore_movies():
    """Split a query into matching titles and content-similar titles.

    Used by the "Rate a few movies" search when the user submits a query
    (e.g. hits Enter on "toy story"). Returns two rateable sections:

      * ``matches``  — movies whose title contains the query (the franchise /
        series itself, e.g. Toy Story 1/2/3), ranked by popularity.
      * ``similar``  — content-based recommendations seeded from the query,
        resolved back to rateable MovieLens movies and de-duplicated against
        ``matches``.

    Query string: ``?q=toy story``. Response:
    ``{"matches": [...], "similar": [...]}`` where each item is
    ``{movie_id, title, genres, poster_url}``.
    """
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"matches": [], "similar": []}), 200

    # Section 1: direct title matches (the series itself).
    matches = collab.search_movies(query, limit=12)
    match_ids = {m["movie_id"] for m in matches}

    # Section 2: content-based similar titles, resolved to rateable movies.
    similar = []
    seen = set(match_ids)
    content_titles = content_recommend(query)
    if isinstance(content_titles, list):
        for title in content_titles:
            resolved = collab.resolve_title(title)
            if resolved and resolved["movie_id"] not in seen:
                seen.add(resolved["movie_id"])
                similar.append(resolved)

    for item in matches + similar:
        item["poster_url"] = get_poster_url(item["title"])

    logger.info(
        "Explore q=%r -> %d matches, %d similar",
        query,
        len(matches),
        len(similar),
    )
    return jsonify({"matches": matches, "similar": similar}), 200


@ratings_bp.route("/api/rate", methods=["POST"])
def api_rate():
    """Generate recommendations for a cold-start user from ad-hoc ratings.

    Request body: ``{"ratings": [{"movie_id": 1, "rating": 4.5}, ...]}``
    Response: ``{"recommendations": [{"movie_id", "title", "poster_url",
    "genres", "score"}, ...]}``
    """
    req = validate(RateRequest, request.get_json(silent=True) or {})
    cleaned = [item.model_dump() for item in req.ratings]

    recs = collab.recommend_for_new_user(cleaned, n=10)
    logger.info("Cold-start fold-in: %d ratings -> %d recs", len(cleaned), len(recs))
    for item in recs:
        item["poster_url"] = get_poster_url(item["title"])
    return jsonify({"recommendations": recs}), 200
