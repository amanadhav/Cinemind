"""Recommendation endpoints: content-based, collaborative (SVD), and hybrid."""
import re

from flask import Blueprint, jsonify, request

from app.services import collab_recommender as collab
from app.services.content_recommender import recommend
from app.services.poster_service import get_poster_url

recommend_bp = Blueprint("recommend", __name__)


def _normalize_title(title):
    """Normalize a title for cross-source dedup (lowercase, drop year, alnum)."""
    text = re.sub(r"\s*\(\d{4}\)\s*$", "", str(title)).lower()
    return re.sub(r"[^a-z0-9]", "", text)


@recommend_bp.route("/api/recommend/content", methods=["POST"])
def api_recommend_content():
    """JSON content-based recommendations.

    Request body: ``{"movie": "Inception"}``
    Response: ``[{"title": ..., "poster_url": ...}, ...]``
    """
    payload = request.get_json(silent=True) or {}
    movie = payload.get("movie")
    if not movie:
        return jsonify({"error": "Missing 'movie' in request body"}), 400

    movie_list = recommend(movie)
    if not isinstance(movie_list, list):
        return jsonify({"error": "Movie not found in our database"}), 404

    results = [
        {"title": title, "poster_url": get_poster_url(title)} for title in movie_list
    ]
    return jsonify(results), 200


@recommend_bp.route("/api/recommend/collaborative", methods=["POST"])
def api_recommend_collaborative():
    """Real-time SVD recommendations for a known MovieLens user.

    Request body: ``{"user_id": 42}``
    Response: ``{"recommendations": [{"movie_id", "title", "poster_url",
    "genres", "score"}, ...]}``
    """
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "'user_id' must be an integer"}), 400

    if not collab.is_valid_user_id(user_id):
        return (
            jsonify(
                {
                    "error": (
                        f"'user_id' must be between {collab.MIN_USER_ID} and "
                        f"{collab.MAX_USER_ID}"
                    )
                }
            ),
            400,
        )

    recs = collab.recommend_for_user(user_id, n=10)
    for item in recs:
        item["poster_url"] = get_poster_url(item["title"])
    return jsonify({"recommendations": recs}), 200


@recommend_bp.route("/api/recommend/hybrid", methods=["POST"])
def api_recommend_hybrid():
    """Merge content-based and collaborative (SVD) recommendations.

    Request body must include ``movie`` plus a collaborative signal, either:
      * ``user_id`` — recommendations for a known MovieLens user, or
      * ``ratings`` — a list of ``{movie_id, rating}`` for a cold-start user.

    Response: top 10 ``{"title", "poster_url", "source"}`` items where
    ``source`` is ``"content"``, ``"collaborative"``, or ``"both"``.
    """
    payload = request.get_json(silent=True) or {}
    movie = payload.get("movie")
    user_id = payload.get("user_id")
    ratings = payload.get("ratings")

    if not movie:
        return jsonify({"error": "Missing 'movie' in request body"}), 400

    # Resolve the collaborative side from whichever signal was provided.
    if ratings is not None:
        cleaned = []
        for entry in ratings if isinstance(ratings, list) else []:
            if not isinstance(entry, dict):
                continue
            try:
                cleaned.append(
                    {
                        "movie_id": int(entry.get("movie_id")),
                        "rating": float(entry.get("rating")),
                    }
                )
            except (TypeError, ValueError):
                continue
        if not cleaned:
            return (
                jsonify({"error": "'ratings' must contain valid {movie_id, rating}"}),
                400,
            )
        collab_list = [
            item["title"] for item in collab.recommend_for_new_user(cleaned, n=10)
        ]
    else:
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return jsonify({"error": "'user_id' must be an integer"}), 400
        if not collab.is_valid_user_id(user_id):
            return jsonify({"error": "'user_id' must be between 1 and 610"}), 400
        collab_list = [
            item["title"] for item in collab.recommend_for_user(user_id, n=10)
        ]

    content_list = recommend(movie)
    if not isinstance(content_list, list):
        content_list = []

    sources_by_key = {}
    title_by_key = {}

    def register(title, source):
        key = _normalize_title(title)
        if not key:
            return
        sources_by_key.setdefault(key, set()).add(source)
        title_by_key.setdefault(key, title)

    for title in content_list:
        register(title, "content")
    for title in collab_list:
        register(title, "collaborative")

    ordered_keys = []
    emitted = set()

    def emit(title):
        key = _normalize_title(title)
        if key and key not in emitted:
            emitted.add(key)
            ordered_keys.append(key)

    max_len = max(len(content_list), len(collab_list))
    for i in range(max_len):
        if i < len(content_list):
            emit(content_list[i])
        if i < len(collab_list):
            emit(collab_list[i])

    def source_label(key):
        sources = sources_by_key[key]
        if {"content", "collaborative"} <= sources:
            return "both"
        return "content" if "content" in sources else "collaborative"

    results = [
        {
            "title": title_by_key[key],
            "poster_url": get_poster_url(title_by_key[key]),
            "source": source_label(key),
        }
        for key in ordered_keys
    ]
    results.sort(key=lambda r: 0 if r["source"] == "both" else 1)
    return jsonify(results[:10]), 200
