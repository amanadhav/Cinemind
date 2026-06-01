"""Cross-cutting JSON API endpoints: hybrid recommendations, search, health."""
import re

from flask import Blueprint, jsonify, request

from app.services.collab_recommender import get_collaborative, is_valid_user_id
from app.services.content_recommender import (
    is_model_loaded,
    recommend,
    search_titles,
)
from app.services.poster_service import get_poster_url

api_bp = Blueprint("api", __name__)


def _normalize_title(title):
    """Normalize a title for cross-source dedup.

    Lowercases, drops a trailing ``(YYYY)`` suffix, and strips all
    non-alphanumeric characters so that e.g. ``"Inception"`` and
    ``"inception"`` collapse to the same key.
    """
    text = re.sub(r"\s*\(\d{4}\)\s*$", "", str(title)).lower()
    return re.sub(r"[^a-z0-9]", "", text)


@api_bp.route("/api/recommend/hybrid", methods=["POST"])
def api_recommend_hybrid():
    """Merge content-based and collaborative recommendations.

    Request body: ``{"movie": "Inception", "user_id": 42}``
    Response: top 10 ``{"title", "poster_url", "source"}`` items where
    ``source`` is ``"content"``, ``"collaborative"``, or ``"both"``.
    """
    payload = request.get_json(silent=True) or {}
    movie = payload.get("movie")
    user_id = payload.get("user_id")

    if not movie:
        return jsonify({"error": "Missing 'movie' in request body"}), 400
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "'user_id' must be an integer"}), 400
    if not is_valid_user_id(user_id):
        return jsonify({"error": "'user_id' must be between 1 and 610"}), 400

    # Content-based titles (may be an error string if no match).
    content_list = recommend(movie)
    if not isinstance(content_list, list):
        content_list = []

    # Collaborative titles: combine matrix + knn results.
    matrix_data, knn_data = get_collaborative(user_id)
    collab_list = list(matrix_data) + list(knn_data)

    # First pass: determine the source set for every candidate title.
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

    # Second pass: interleave content and collaborative round-robin so the
    # result is a genuine blend rather than one source padded by the other.
    # Each unique title is emitted once, on its first appearance.
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

    # Promote titles recommended by both sources to the front, keeping the
    # interleaved order stable otherwise.
    results.sort(key=lambda r: 0 if r["source"] == "both" else 1)
    return jsonify(results[:10]), 200


@api_bp.route("/api/search", methods=["GET"])
def api_search():
    """Autocomplete search over known movie titles.

    Query string: ``?q=inc`` -> JSON array of up to 10 matching titles.
    """
    query = request.args.get("q", "")
    return jsonify(search_titles(query, limit=10)), 200


@api_bp.route("/health", methods=["GET"])
def health():
    """Liveness/readiness check reporting whether the model is loaded."""
    return jsonify({"status": "ok", "model_loaded": is_model_loaded()}), 200
