"""Content-based recommendation routes.

Provides the server-rendered home/recommendation pages plus the JSON
``/api/recommend/content`` endpoint.
"""
from flask import Blueprint, jsonify, render_template, request

from app.services.content_recommender import recommend
from app.services.poster_service import get_poster_url

content_bp = Blueprint("content_based", __name__)


@content_bp.route("/homepage", methods=["GET"])
def homepage():
    return render_template("index.html")


@content_bp.route("/content_based", methods=["POST"])
def show_content_based_recommendation():
    movie_name = request.form["movie_name"]

    # recommend() returns a list of titles directly, or an error string when
    # the movie cannot be matched (no intermediate file3.csv).
    movie_list = recommend(movie_name)
    if not isinstance(movie_list, list):
        return "Couldn't find that! Please try again."

    movie_inputs = []
    for movie in movie_list:
        img_url = get_poster_url(movie)
        movie_inputs.append({"movie_name": movie, "img_url": img_url})

    return render_template(
        "content_based_recommendation.html",
        movie_name=movie_name,
        movie_list=movie_inputs,
    )


@content_bp.route("/api/recommend/content", methods=["POST"])
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
