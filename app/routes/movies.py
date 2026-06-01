"""Movie detail endpoint backed by the MovieLens catalog + TMDB metadata."""
from flask import Blueprint, jsonify, request

from app.services import collab_recommender as collab
from app.services.poster_service import get_movie_details

movies_bp = Blueprint("movies", __name__)


@movies_bp.route("/api/movie/<int:movie_id>", methods=["GET"])
def api_movie_detail(movie_id):
    """Return rich metadata for a MovieLens ``movie_id``.

    Resolves the movieId to a title via the in-memory MovieLens catalog, then
    enriches it with TMDB metadata (overview, runtime, tagline, backdrop).

    Response: ``{movie_id, title, year, genres, overview, runtime, tagline,
    poster_url, backdrop_url}``.
    """
    model = collab.get_model()
    title = model.title_by_id.get(movie_id)
    if title is None:
        return jsonify({"error": "Movie not found"}), 404

    details = get_movie_details(title)
    details["movie_id"] = movie_id
    # Prefer the local catalog genres if TMDB returned none.
    if not details.get("genres"):
        raw = model.genres_by_id.get(movie_id, "")
        details["genres"] = [g for g in raw.split("|") if g and g != "(no genres listed)"]
    return jsonify(details), 200


@movies_bp.route("/api/movie/detail", methods=["GET"])
def api_movie_detail_by_title():
    """Return rich TMDB metadata for a movie by ``title`` query parameter.

    Used by result cards (content/hybrid) that carry a title but no MovieLens
    id. Query string: ``?title=Inception``.
    """
    title = request.args.get("title", "").strip()
    if not title:
        return jsonify({"error": "Missing 'title' query parameter"}), 400

    details = get_movie_details(title)
    details.setdefault("movie_id", None)
    return jsonify(details), 200

