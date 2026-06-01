"""Collaborative filtering recommendation routes.

Phase 1: faithful port of the original routes. REST/JSON endpoints added
in Phase 4.
"""
from flask import Blueprint, render_template, request

from app.services.collab_recommender import get_collaborative
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
