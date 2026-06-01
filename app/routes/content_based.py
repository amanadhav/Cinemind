"""Content-based recommendation routes.

REST/JSON endpoints are added in Phase 4. This module currently serves the
home page and the server-rendered content-based recommendation page.
"""
from flask import Blueprint, render_template, request

from app.services.content_recommender import recommend
from app.services.poster_service import ImageScraper

content_bp = Blueprint("content_based", __name__)
imgscrape = ImageScraper()


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
        img_url = imgscrape.get_poster_url(movie)
        movie_inputs.append({"movie_name": movie, "img_url": img_url})

    return render_template(
        "content_based_recommendation.html",
        movie_name=movie_name,
        movie_list=movie_inputs,
    )
