"""Flask application factory for CineMind."""
from flask import Flask

from config import get_config


def create_app(config_name=None):
    """Create and configure a Flask application instance.

    Args:
        config_name: Optional environment name ("development" / "production").
            Falls back to the FLASK_ENV environment variable or the
            production-safe default.
    """
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))

    # Register blueprints.
    from app.routes.content_based import content_bp
    from app.routes.collaborative import collaborative_bp

    app.register_blueprint(content_bp)
    app.register_blueprint(collaborative_bp)

    return app
