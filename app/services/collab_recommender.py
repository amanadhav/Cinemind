"""Real-time collaborative filtering via truncated SVD (matrix factorization).

This module replaces the old precomputed-CSV lookup. On first use it loads the
raw MovieLens ratings, builds a user-item rating matrix, mean-centers it per
user, and factorizes it with ``scipy.sparse.linalg.svds`` (k=50 latent
factors). The decomposed matrices are cached as module-level singletons so the
factorization runs once per process (~1-2s for the MovieLens 100K set).

At request time:
  * Known users (IDs 1-610) get recommendations from their reconstructed
    predicted-rating row, excluding movies they have already rated.
  * New users (the "rate a few movies" cold-start flow) are folded into the
    latent space on the fly from the ratings they provide.

The ML lives here, decoupled from Flask, so it can be unit-tested directly.
"""
import logging

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

from config import MOVIES_CSV, RATINGS_CSV

logger = logging.getLogger(__name__)

# Number of latent factors for the SVD.
N_FACTORS = 50

# Valid (inclusive) range of user IDs present in the MovieLens dataset.
MIN_USER_ID = 1
MAX_USER_ID = 610

# Module-level singletons, populated on the first call to ``get_model()``.
_model = None


class _CollabModel:
    """Container for the trained SVD artifacts and id<->index mappings."""

    def __init__(self):
        ratings = pd.read_csv(RATINGS_CSV)
        movies = pd.read_csv(MOVIES_CSV)

        # Stable ordering of users and movies; index positions are used as
        # matrix rows/columns throughout.
        self.user_ids = np.sort(ratings["userId"].unique())
        self.movie_ids = np.sort(ratings["movieId"].unique())
        self.user_pos = {uid: i for i, uid in enumerate(self.user_ids)}
        self.movie_pos = {mid: i for i, mid in enumerate(self.movie_ids)}

        # movieId -> human-readable title (from movies.csv).
        self.title_by_id = dict(zip(movies["movieId"], movies["title"]))
        self.genres_by_id = dict(zip(movies["movieId"], movies["genres"]))

        # Popularity (rating count) per movie, for the cold-start seed grid.
        self._popularity = (
            ratings.groupby("movieId").size().sort_values(ascending=False)
        )

        # Build the dense user-item matrix from a sparse construction.
        rows = ratings["userId"].map(self.user_pos).to_numpy()
        cols = ratings["movieId"].map(self.movie_pos).to_numpy()
        vals = ratings["rating"].to_numpy(dtype=np.float64)
        n_users = len(self.user_ids)
        n_movies = len(self.movie_ids)
        sparse_matrix = csr_matrix(
            (vals, (rows, cols)), shape=(n_users, n_movies)
        )
        dense = sparse_matrix.toarray()

        # Mean-center each user's ratings (only over movies they rated) so the
        # factorization models deviations from a user's personal baseline.
        rated_mask = dense > 0
        rated_counts = rated_mask.sum(axis=1)
        sums = dense.sum(axis=1)
        self.user_means = np.divide(
            sums, rated_counts, out=np.zeros_like(sums), where=rated_counts > 0
        )
        demeaned = dense - self.user_means.reshape(-1, 1)

        # Truncated SVD. k must be < min(matrix dimensions).
        k = min(N_FACTORS, min(dense.shape) - 1)
        u, sigma, vt = svds(demeaned, k=k)
        # svds returns factors in ascending order of singular value; reverse
        # so the most significant factors come first (convention, not required).
        order = np.argsort(sigma)[::-1]
        self.U = u[:, order]
        self.sigma = sigma[order]
        self.Vt = vt[order, :]

        self._dense = dense  # retained to know which movies a user has rated

    # -- known users -----------------------------------------------------
    def recommend_for_user(self, user_id, n=10):
        """Top-``n`` recommendations for a known user, excluding rated movies."""
        pos = self.user_pos[user_id]
        predicted = self.U[pos] @ np.diag(self.sigma) @ self.Vt
        predicted = predicted + self.user_means[pos]
        already_rated = self._dense[pos] > 0
        return self._top_n(predicted, already_rated, n)

    # -- cold-start users ------------------------------------------------
    def recommend_for_new_user(self, ratings, n=10):
        """Top-``n`` recommendations for a new user from ad-hoc ratings.

        ``ratings`` is a list of ``{"movie_id": int, "rating": float}``. The
        ratings are turned into a sparse vector, mean-centered, projected into
        the latent space (fold-in), and reconstructed into predicted scores.
        """
        n_movies = len(self.movie_ids)
        vector = np.zeros(n_movies, dtype=np.float64)
        rated_mask = np.zeros(n_movies, dtype=bool)

        provided = []
        for entry in ratings:
            mid = entry.get("movie_id")
            score = entry.get("rating")
            if mid in self.movie_pos and score is not None:
                idx = self.movie_pos[mid]
                vector[idx] = float(score)
                rated_mask[idx] = True
                provided.append(float(score))

        if not provided:
            return []

        user_mean = float(np.mean(provided))
        demeaned = np.where(rated_mask, vector - user_mean, 0.0)

        # Fold-in: project the rating vector onto the item latent factors.
        # user_latent = (r . Vt^T) / sigma  ; predicted = (user_latent * sigma) . Vt
        user_latent = (demeaned @ self.Vt.T) / self.sigma
        predicted = (user_latent * self.sigma) @ self.Vt + user_mean
        return self._top_n(predicted, rated_mask, n)

    # -- popularity seed -------------------------------------------------
    def popular_movies(self, n=20):
        """Return the ``n`` most-rated movies as ``{movie_id, title, genres}``."""
        out = []
        for mid in self._popularity.index[:n]:
            out.append(
                {
                    "movie_id": int(mid),
                    "title": self.title_by_id.get(mid, str(mid)),
                    "genres": self.genres_by_id.get(mid, ""),
                }
            )
        return out

    # -- helpers ---------------------------------------------------------
    def _top_n(self, predicted, exclude_mask, n):
        scores = predicted.copy()
        scores[exclude_mask] = -np.inf
        top_idx = np.argsort(scores)[::-1][:n]
        results = []
        for idx in top_idx:
            if not np.isfinite(scores[idx]):
                continue
            mid = int(self.movie_ids[idx])
            results.append(
                {
                    "movie_id": mid,
                    "title": self.title_by_id.get(mid, str(mid)),
                    "genres": self.genres_by_id.get(mid, ""),
                    "score": round(float(predicted[idx]), 3),
                }
            )
        return results


def get_model():
    """Load and cache the SVD model singleton (trains on first call)."""
    global _model
    if _model is None:
        logger.info("Training collaborative SVD model...")
        _model = _CollabModel()
        logger.info("Collaborative model ready")
    return _model


def is_model_loaded():
    """Return True if the collaborative model has been trained/cached."""
    return _model is not None


def is_valid_user_id(user_id):
    """Return True if ``user_id`` is an int within the supported range."""
    return isinstance(user_id, int) and MIN_USER_ID <= user_id <= MAX_USER_ID


def recommend_for_user(user_id, n=10):
    """Top-``n`` recommendations for a known user (list of dicts)."""
    return get_model().recommend_for_user(user_id, n=n)


def recommend_for_new_user(ratings, n=10):
    """Top-``n`` recommendations for a cold-start user from ad-hoc ratings."""
    return get_model().recommend_for_new_user(ratings, n=n)


def popular_movies(n=20):
    """The ``n`` most-rated movies, used to seed the rating UI."""
    return get_model().popular_movies(n=n)
