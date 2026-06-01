"""Application configuration.

Defines a base configuration plus development and production variants.
Paths are resolved relative to the project root so the app can be run from
any working directory.
"""
import os

# Project root (directory containing this file).
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Data locations.
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_DATA_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DATA_DIR = os.path.join(DATA_DIR, "processed")
PRECOMPUTED_DATA_DIR = os.path.join(DATA_DIR, "precomputed")

# Specific data files.
CONTENT_TRAIN_CSV = os.path.join(
    PROCESSED_DATA_DIR, "content_based_final_data_train.csv"
)
KNN_RECOMMENDATIONS_CSV = os.path.join(PRECOMPUTED_DATA_DIR, "knn_recommendations.csv")
MATRIX_RECOMMENDATIONS_CSV = os.path.join(
    PRECOMPUTED_DATA_DIR, "matrix_recommendations.csv"
)


class Config:
    """Base configuration shared by all environments."""

    DEBUG = False
    TESTING = False

    # External services.
    TMDB_API_KEY = os.environ.get("TMDB_API_KEY")

    # Data paths (exposed on the config so they can be overridden in tests).
    CONTENT_TRAIN_CSV = CONTENT_TRAIN_CSV
    KNN_RECOMMENDATIONS_CSV = KNN_RECOMMENDATIONS_CSV
    MATRIX_RECOMMENDATIONS_CSV = MATRIX_RECOMMENDATIONS_CSV


class DevelopmentConfig(Config):
    """Local development settings."""

    DEBUG = True


class ProductionConfig(Config):
    """Production settings."""

    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": ProductionConfig,
}


def get_config(name=None):
    """Return the config class for the given environment name.

    Falls back to the ``FLASK_ENV`` environment variable, then to the
    production-safe default.
    """
    if name is None:
        name = os.environ.get("FLASK_ENV", "default")
    return config_by_name.get(name, config_by_name["default"])
