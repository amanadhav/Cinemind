"""Centralized logging configuration for CineMind.

Every log record carries a request-scoped correlation id (``request_id``) so a
single API call can be traced end-to-end across services. ``configure_logging``
is the one entry point, called once by the application factory.
"""
import logging
import sys

from flask import g, has_request_context

# Format string includes the correlation id injected by ``RequestIdFilter``.
_LOG_FORMAT = "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


class RequestIdFilter(logging.Filter):
    """Attach the current request's correlation id to every log record.

    When there is no active request (startup, tests, background work) the id
    falls back to ``"-"`` so the formatter never raises on a missing field.
    """

    def filter(self, record):
        if has_request_context():
            record.request_id = getattr(g, "request_id", "-")
        else:
            record.request_id = "-"
        return True


def configure_logging(level=logging.INFO):
    """Install a single stdout handler with the request-id-aware formatter.

    Idempotent: repeated calls (e.g. across test app instances) reuse the
    existing CineMind handler instead of stacking duplicates.
    """
    root = logging.getLogger()
    root.setLevel(level)

    # Reuse our handler if it is already installed.
    for handler in root.handlers:
        if getattr(handler, "_cinemind", False):
            return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT))
    handler.addFilter(RequestIdFilter())
    handler._cinemind = True  # marker so we don't add it twice

    # Drop any pre-existing default handlers (e.g. from basicConfig) so logs
    # aren't emitted twice, then install ours.
    root.handlers = []
    root.addHandler(handler)
