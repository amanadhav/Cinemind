"""App-wide error handling for the CineMind API.

Registers a small set of handlers so every failure path returns a consistent
JSON envelope — ``{"error": <message>, "type": <category>}`` — and is logged
with the request's correlation id. Unexpected exceptions are logged with a full
traceback but never leak internal details to the client.
"""
import logging

from werkzeug.exceptions import HTTPException

from app.schemas import ValidationError

logger = logging.getLogger(__name__)


def _json_error(message, error_type, status):
    return {"error": message, "type": error_type}, status


def register_error_handlers(app):
    """Attach JSON error handlers to ``app``."""

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        # Client-side problem: log at warning, return the clean message.
        logger.warning("Validation error: %s", exc.message)
        return _json_error(exc.message, "validation_error", 400)

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc):
        # Preserve Flask's status code (404, 405, ...) in JSON form.
        logger.info("HTTP %s on %s: %s", exc.code, _safe_path(), exc.description)
        return _json_error(exc.description, "http_error", exc.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        # Anything uncaught is a server bug: full traceback in the logs, a
        # generic message to the client.
        logger.error("Unhandled exception on %s", _safe_path(), exc_info=True)
        return _json_error(
            "An internal error occurred. Please try again.",
            "internal_error",
            500,
        )


def _safe_path():
    """Return the current request path for logging, tolerant of no context."""
    try:
        from flask import request

        return request.path
    except Exception:  # pragma: no cover - defensive
        return "?"
