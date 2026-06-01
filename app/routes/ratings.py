"""Cold-start rating flow: rate a few movies, get personalized picks."""
import logging

from flask import Blueprint, jsonify, request

from app.schemas import RateRequest, validate
from app.services import collab_recommender as collab
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
