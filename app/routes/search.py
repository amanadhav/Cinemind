"""Search/autocomplete and health-check endpoints."""
from flask import Blueprint, jsonify, request

from app.services.collab_recommender import is_model_loaded as collab_loaded
from app.services.content_recommender import is_model_loaded, search_titles

search_bp = Blueprint("search", __name__)


@search_bp.route("/api/search", methods=["GET"])
def api_search():
    """Autocomplete search over known movie titles.

    Query string: ``?q=inc`` -> JSON array of up to 10 matching titles.
    """
    query = request.args.get("q", "")
    return jsonify(search_titles(query, limit=10)), 200


@search_bp.route("/health", methods=["GET"])
def health():
    """Liveness/readiness check reporting whether the models are loaded."""
    return (
        jsonify(
            {
                "status": "ok",
                "model_loaded": is_model_loaded(),
                "collab_model_loaded": collab_loaded(),
            }
        ),
        200,
    )
