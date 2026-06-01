"""Flask application factory for CineMind."""
import logging

from flask import Flask
from flask_cors import CORS

from config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app(config_name=None):
    """Create and configure a Flask application instance.

    Args:
        config_name: Optional environment name ("development" / "production").
            Falls back to the FLASK_ENV environment variable or the
            production-safe default.
    """
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    # Allow the Next.js dev frontend (and configured origins) to call the API.
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["http://localhost:3000"]))

    # Register blueprints (JSON API only; the UI is the Next.js frontend).
    from app.routes.recommend import recommend_bp
    from app.routes.ratings import ratings_bp
    from app.routes.search import search_bp
    from app.routes.movies import movies_bp

    app.register_blueprint(recommend_bp)
    app.register_blueprint(ratings_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(movies_bp)

    return app
