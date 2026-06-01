"""Recommendation endpoints: content-based, collaborative (SVD), and hybrid."""
import logging
import re

from flask import Blueprint, jsonify, request

from app.schemas import (
    CollaborativeRequest,
    ContentRequest,
    HybridRequest,
    validate,
)
from app.services import collab_recommender as collab
from app.services.content_recommender import recommend
from app.services.poster_service import get_poster_url

logger = logging.getLogger(__name__)

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
    req = validate(ContentRequest, request.get_json(silent=True) or {})

    movie_list = recommend(req.movie)
    if not isinstance(movie_list, list):
        logger.info("Content lookup miss for query=%r", req.movie)
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
    req = validate(CollaborativeRequest, request.get_json(silent=True) or {})

    recs = collab.recommend_for_user(req.user_id, n=10)
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
    req = validate(HybridRequest, request.get_json(silent=True) or {})
    signal, value = req.collaborative_signal()

    # Resolve the collaborative side from whichever signal was provided.
    if signal == "ratings":
        collab_list = [
            item["title"] for item in collab.recommend_for_new_user(value, n=10)
        ]
    else:
        collab_list = [
            item["title"] for item in collab.recommend_for_user(value, n=10)
        ]

    content_list = recommend(req.movie)
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
