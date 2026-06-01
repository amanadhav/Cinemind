"""Collaborative filtering recommendation routes.

Provides the server-rendered recommendation page plus the JSON
``/api/recommend/collaborative`` endpoint.
"""
from flask import Blueprint, jsonify, render_template, request

from app.services.collab_recommender import (
    MAX_USER_ID,
    MIN_USER_ID,
    get_collaborative,
    is_valid_user_id,
)
from app.services.poster_service import get_poster_url

collaborative_bp = Blueprint("collaborative", __name__)


class UserIDException(Exception):
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)


@collaborative_bp.route("/show_recommendation", methods=["POST"])
def show_recommendation():
    try:
        user_id = int(request.form["user_id"])
        if not 0 < user_id < 611:
            raise UserIDException(user_id)
        matrix_data, knn_data = get_collaborative(user_id)
        matrix_send_data = []
        knn_send_data = []
        for x in matrix_data:
            url = get_poster_url(x)
            matrix_send_data.append(url)
        for x in knn_data:
            url = get_poster_url(x)
            knn_send_data.append(url)

        return render_template(
            "portfolio-details.html",
            matrix_data=matrix_send_data,
            knn_data=knn_send_data,
        )
    except UserIDException as e:
        return (
            f"Please enter a userid between 1 and 610, your userid was{str(e.value)}"
        )


@collaborative_bp.route("/api/recommend/collaborative", methods=["POST"])
def api_recommend_collaborative():
    """JSON collaborative recommendations for a given user.

    Request body: ``{"user_id": 42}``
    Response: ``{"knn_results": [...], "matrix_results": [...]}`` where each
    item is ``{"title": ..., "poster_url": ...}``.
    """
    payload = request.get_json(silent=True) or {}
    user_id = payload.get("user_id")

    # Coerce numeric strings to int, but reject anything non-integer.
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return jsonify({"error": "'user_id' must be an integer"}), 400

    if not is_valid_user_id(user_id):
        return (
            jsonify(
                {
                    "error": (
                        f"'user_id' must be between {MIN_USER_ID} and "
                        f"{MAX_USER_ID}"
                    )
                }
            ),
            400,
        )

    matrix_data, knn_data = get_collaborative(user_id)
    knn_results = [
        {"title": title, "poster_url": get_poster_url(title)} for title in knn_data
    ]
    matrix_results = [
        {"title": title, "poster_url": get_poster_url(title)} for title in matrix_data
    ]
    return jsonify({"knn_results": knn_results, "matrix_results": matrix_results}), 200
