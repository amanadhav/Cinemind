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
RATINGS_CSV = os.path.join(RAW_DATA_DIR, "ratings.csv")
MOVIES_CSV = os.path.join(RAW_DATA_DIR, "movies.csv")

# Legacy precomputed CSVs (kept for the notebooks; no longer used at runtime
# now that collaborative filtering does real-time SVD inference).
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

    # Frontend origins allowed to call the API (comma-separated env override).
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")

    # Data paths (exposed on the config so they can be overridden in tests).
    CONTENT_TRAIN_CSV = CONTENT_TRAIN_CSV
    RATINGS_CSV = RATINGS_CSV
    MOVIES_CSV = MOVIES_CSV
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
