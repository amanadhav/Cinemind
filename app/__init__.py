"""Flask application factory for CineMind."""
import logging
import time
import uuid

from flask import Flask, g, request
from flask_cors import CORS

from app.errors import register_error_handlers
from app.logging_config import configure_logging
from config import get_config

configure_logging()
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

    _register_request_logging(app)
    register_error_handlers(app)

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


def _register_request_logging(app):
    """Tag each request with a correlation id and log timing on completion."""

    @app.before_request
    def _start_timer():
        g.request_id = uuid.uuid4().hex[:8]
        g.start_time = time.perf_counter()

    @app.after_request
    def _log_request(response):
        # /health is polled frequently; keep it quiet to avoid log spam.
        if request.path != "/health":
            elapsed_ms = (time.perf_counter() - getattr(g, "start_time", time.perf_counter())) * 1000
            logger.info(
                "%s %s -> %s (%.1f ms)",
                request.method,
                request.path,
                response.status_code,
                elapsed_ms,
            )
        # Expose the correlation id so clients can quote it in bug reports.
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")
        return response
