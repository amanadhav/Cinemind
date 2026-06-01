"""Shared pytest fixtures and path setup for the CineMind test suite."""
import os
import sys

import pytest

# Ensure the project root is importable when pytest is invoked from anywhere.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app import create_app  # noqa: E402


@pytest.fixture()
def app():
    """A Flask app instance configured for testing."""
    application = create_app("development")
    application.config.update(TESTING=True)
    return application


@pytest.fixture()
def client(app):
    """A Flask test client."""
    return app.test_client()
