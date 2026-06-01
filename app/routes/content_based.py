"""Content-based recommendation routes.

Phase 1: faithful port of the original routes. REST/JSON endpoints added
in Phase 4.
"""
import pandas as pd
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
    try:
        movie_name = request.form["movie_name"]
        recommend(movie_name)
        content_based_rec = pd.read_csv("file3.csv")
        movie_list = content_based_rec.columns.tolist()
        movie_inputs = []
        for movie in movie_list:
            img_url = imgscrape.get_poster_url(movie)
            movie_inputs.append({"movie_name": movie, "img_url": img_url})

        return render_template(
            "content_based_recommendation.html",
            movie_name=movie_name,
            movie_list=movie_inputs,
        )
    except Exception:
        return "Couldn't find that! Please try again."
