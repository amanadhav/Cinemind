"""Collaborative filtering via truncated SVD (matrix factorization).

Recommendation quality comes from a truncated SVD of the MovieLens user-item
rating matrix. Because factorizing the full 25M-rating matrix needs ~2 GB of
RAM, the heavy training is done **offline** by ``build_svd_model.py`` on a
developer machine, which saves the compact trained artifacts to
``data/processed/svd_model.npz`` (~11 MB):

  * ``Vt``            — item latent-factor matrix (k x n_movies)
  * ``sigma``         — singular values (k,)
  * ``movie_ids``     — MovieLens ids defining the column order of ``Vt``
  * ``rating_counts`` — per-movie popularity, aligned to ``movie_ids``
  * ``max_user_id``   — highest MovieLens user id

At request time this module loads that ``.npz`` (peak RAM ~50 MB) and serves:

  * Cold-start recommendations (the "rate a few movies" flow): the user's
    ad-hoc ratings are folded into the latent space using ``Vt``/``sigma`` and
    reconstructed into predicted scores. This is the path the frontend uses.

If the precomputed model is missing, the module falls back to building the SVD
directly from a local ``ratings.csv`` / ``ratings.csv.gz`` (useful for local
development). If neither is available it runs in catalog-only mode where
popularity falls back to catalog order and collaborative scoring is disabled.

The ML lives here, decoupled from Flask, so it can be unit-tested directly.
"""
import gzip
import logging
import os
import re

import numpy as np
import pandas as pd

from config import MOVIES_CSV, RATINGS_CSV, SVD_MODEL_NPZ

logger = logging.getLogger(__name__)

# Number of latent factors for the SVD (must match build_svd_model.py).
N_FACTORS = 50

# Valid (inclusive) range of user IDs present in the MovieLens dataset.
# MAX_USER_ID is updated dynamically when a model/ratings file is loaded.
MIN_USER_ID = 1
MAX_USER_ID = 162541  # ML-25M default

# Module-level singleton, populated on the first call to ``get_model()``.
_model = None


def normalize_title(title):
    """Normalize a movie title for cross-dataset matching.

    Strips a trailing ``(YYYY)`` year, moves a trailing article (``", The"``,
    ``", A"``, ``", An"``) back to the front, lowercases, and removes all
    non-alphanumeric characters. This lets MovieLens titles like
    ``"Matrix, The (1999)"`` match content-dataset titles like ``"the matrix"``.
    """
    text = re.sub(r"\s*\(\d{4}\)\s*$", "", str(title)).strip()
    # Move a trailing article to the front: "Matrix, The" -> "The Matrix".
    m = re.match(r"^(.*),\s+(The|A|An)$", text, flags=re.IGNORECASE)
    if m:
        text = f"{m.group(2)} {m.group(1)}"
    return re.sub(r"[^a-z0-9]", "", text.lower())


class _CollabModel:
    """Holds the SVD item factors, popularity, and id<->index mappings."""

    def __init__(self):
        movies = pd.read_csv(MOVIES_CSV)
        self.title_by_id = dict(zip(movies["movieId"], movies["title"]))
        self.genres_by_id = dict(zip(movies["movieId"], movies["genres"]))

        if os.path.isfile(SVD_MODEL_NPZ):
            self._load_precomputed()
        elif os.path.isfile(RATINGS_CSV) or os.path.isfile(RATINGS_CSV + ".gz"):
            self._train_from_ratings()
        else:
            self._catalog_only(movies)

        self._build_title_index()

    # -- loaders ---------------------------------------------------------
    def _load_precomputed(self):
        """Load the compact SVD artifacts produced by build_svd_model.py."""
        global MAX_USER_ID
        logger.info("Loading precomputed SVD model from %s", SVD_MODEL_NPZ)
        data = np.load(SVD_MODEL_NPZ)

        self.Vt = data["Vt"].astype(np.float64)
        self.sigma = data["sigma"].astype(np.float64)
        self.movie_ids = data["movie_ids"]
        rating_counts = data["rating_counts"]
        # Item biases and global baseline (added for a well-posed fold-in).
        # Older models may not have them; fall back gracefully.
        if "movie_means" in data:
            self.movie_means = data["movie_means"].astype(np.float64)
        else:
            self.movie_means = None
        self.global_mean = (
            float(data["global_mean"]) if "global_mean" in data else 3.5
        )
        MAX_USER_ID = int(data["max_user_id"])

        self.movie_pos = {mid: i for i, mid in enumerate(self.movie_ids)}
        self._popularity = pd.Series(rating_counts, index=self.movie_ids)
        self._popularity = self._popularity.sort_values(ascending=False)
        # Popularity aligned to the Vt column order (for tie-breaking).
        self._counts_by_pos = rating_counts.astype(np.float64)

        self._svd_available = True
        logger.info(
            "SVD model ready (%d movies, k=%d)", len(self.movie_ids), len(self.sigma)
        )

    def _train_from_ratings(self):
        """Build the SVD directly from raw ratings (local dev fallback)."""
        global MAX_USER_ID
        from scipy.sparse import csr_matrix
        from scipy.sparse.linalg import svds

        gz = RATINGS_CSV + ".gz"
        if os.path.isfile(RATINGS_CSV):
            logger.info("Loading ratings from %s …", RATINGS_CSV)
            ratings = pd.read_csv(RATINGS_CSV)
        else:
            logger.info("Loading compressed ratings from %s …", gz)
            with gzip.open(gz, "rt") as fh:
                ratings = pd.read_csv(fh)

        user_ids = np.sort(ratings["userId"].unique())
        self.movie_ids = np.sort(ratings["movieId"].unique())
        user_pos = {uid: i for i, uid in enumerate(user_ids)}
        self.movie_pos = {mid: i for i, mid in enumerate(self.movie_ids)}
        MAX_USER_ID = int(user_ids[-1])

        self._popularity = (
            ratings.groupby("movieId").size().sort_values(ascending=False)
        )
        # Per-movie mean (item bias), global mean, and pos-aligned counts.
        means_series = ratings.groupby("movieId")["rating"].mean()
        self.movie_means = np.array(
            [float(means_series.get(mid, 0.0)) for mid in self.movie_ids],
            dtype=np.float64,
        )
        self.global_mean = float(ratings["rating"].mean())
        self._counts_by_pos = np.array(
            [int(self._popularity.get(mid, 0)) for mid in self.movie_ids],
            dtype=np.float64,
        )

        rows = ratings["userId"].map(user_pos).to_numpy()
        cols = ratings["movieId"].map(self.movie_pos).to_numpy()
        vals = ratings["rating"].to_numpy(dtype=np.float64)
        matrix = csr_matrix(
            (vals, (rows, cols)), shape=(len(user_ids), len(self.movie_ids))
        )

        rated_counts = np.diff(matrix.indptr)
        sums = np.array(matrix.sum(axis=1)).flatten()
        user_means = np.divide(
            sums, rated_counts, out=np.zeros_like(sums), where=rated_counts > 0
        )
        demeaned = matrix.copy()
        demeaned.data = demeaned.data.copy()
        for i in range(len(user_ids)):
            if user_means[i] != 0:
                demeaned.data[demeaned.indptr[i]:demeaned.indptr[i + 1]] -= user_means[i]

        k = min(N_FACTORS, min(demeaned.shape) - 1)
        _u, sigma, vt = svds(demeaned, k=k)
        order = np.argsort(sigma)[::-1]
        self.sigma = sigma[order]
        self.Vt = vt[order, :]
        self._svd_available = True
        logger.info("SVD trained from raw ratings (%d movies)", len(self.movie_ids))

    def _catalog_only(self, movies):
        """No ratings or model available: serve catalog metadata only."""
        logger.warning(
            "No SVD model or ratings file found — running in catalog-only mode. "
            "Collaborative recommendations are disabled."
        )
        all_ids = movies["movieId"].to_numpy()
        self.movie_ids = all_ids
        self.movie_pos = {mid: i for i, mid in enumerate(all_ids)}
        # Popularity falls back to catalog order (descending pseudo-count).
        self._popularity = pd.Series(np.arange(len(all_ids), 0, -1), index=all_ids)
        self.movie_means = None
        self.global_mean = 3.5
        self._counts_by_pos = np.zeros(len(all_ids), dtype=np.float64)
        self.Vt = None
        self.sigma = None
        self._svd_available = False

    def _build_title_index(self):
        """Map normalized titles -> the most popular matching movieId."""
        self._id_by_norm_title = {}
        for mid, title in self.title_by_id.items():
            key = normalize_title(title)
            if not key:
                continue
            existing = self._id_by_norm_title.get(key)
            if existing is None or self._popularity.get(mid, 0) > self._popularity.get(
                existing, 0
            ):
                self._id_by_norm_title[key] = mid

    # -- cold-start users ------------------------------------------------
    def recommend_for_new_user(self, ratings, n=10):
        """Top-``n`` recommendations for a new user from ad-hoc ratings.

        ``ratings`` is a list of ``{"movie_id": int, "rating": float}``.

        The fold-in centers each rated item by *that item's* average rating
        (``movie_means``) rather than by the user's own mean. This is crucial:
        if a user rates five films all 5.0, centering by their own mean zeroes
        the entire signal, but centering by item means preserves "they liked
        these films more than the average viewer did" — a real preference
        signal. The residual is projected onto the item latent factors, and
        predictions add the item bias back. A small popularity prior breaks
        near-ties toward well-known titles.
        """
        if not self._svd_available:
            # Fallback: popular movies excluding the ones already rated.
            rated_ids = {r.get("movie_id") for r in ratings}
            return [
                m
                for m in self.popular_movies(n=n + len(rated_ids))
                if m["movie_id"] not in rated_ids
            ][:n]

        n_movies = len(self.movie_ids)
        residual = np.zeros(n_movies, dtype=np.float64)
        rated_mask = np.zeros(n_movies, dtype=bool)

        baseline = (
            self.movie_means
            if self.movie_means is not None
            else np.full(n_movies, self.global_mean)
        )

        n_provided = 0
        for entry in ratings:
            mid = entry.get("movie_id")
            score = entry.get("rating")
            if mid in self.movie_pos and score is not None:
                idx = self.movie_pos[mid]
                # Residual against the item's own average rating.
                residual[idx] = float(score) - baseline[idx]
                rated_mask[idx] = True
                n_provided += 1

        if n_provided == 0:
            return []

        # Fold-in: project the residual vector onto the item latent factors to
        # recover this user's affinity in latent space, then reconstruct a
        # per-movie *personalized* score.
        #   user_latent = (r . Vt^T) / sigma
        #   signal      = (user_latent * sigma) . Vt
        user_latent = (residual @ self.Vt.T) / self.sigma
        signal = (user_latent * self.sigma) @ self.Vt

        # The personalized signal is what actually reflects taste (e.g. Toy
        # Story -> Monsters Inc, Finding Nemo). Its magnitude is far smaller
        # than the item-mean baseline, so ranking on (baseline + signal) would
        # just return the globally highest-rated films for everyone. Instead we
        # rank primarily on the personalized signal and use the item baseline
        # only as a gentle quality prior so low-rated oddities don't slip in.
        sig_std = signal.std()
        if sig_std > 1e-9:
            signal_z = signal / sig_std
        else:
            signal_z = signal
        # Center the baseline so it nudges rather than dominates.
        baseline_centered = baseline - self.global_mean
        ranking = signal_z + 0.5 * baseline_centered

        # The displayed score is the conventional predicted rating
        # (baseline + signal), clamped to the rating scale.
        predicted = baseline + signal

        return self._top_n(ranking, predicted, rated_mask, n)

    # -- known users (not used by the frontend, kept for completeness) ---
    def recommend_for_user(self, user_id, n=10):
        """Known-user recommendations.

        The precomputed model does not retain per-user factors (only item
        factors are needed for cold-start), so this returns an empty list when
        running off the compact model. Use the cold-start flow instead.
        """
        return []

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

    # -- catalog search --------------------------------------------------
    def search_movies(self, query, limit=8):
        """Search rateable movies by title substring.

        Only returns movies present in the model (``movie_pos``) so the results
        can actually be folded into the SVD cold-start. Prefix matches are
        ranked above mid-string matches, then ordered by popularity.

        Returns a list of ``{movie_id, title, genres}``.
        """
        q = str(query).strip().lower()
        if not q:
            return []

        starts, contains = [], []
        for mid, title in self.title_by_id.items():
            if mid not in self.movie_pos:
                continue  # not in the model -> can't be folded in
            
            name = str(title).lower()
            match = re.match(r"^(.*?),\s*(the|a|an)(\s*\(\d{4}\))?$", name)
            if match:
                clean_name = f"{match.group(2)} {match.group(1)}{match.group(3) or ''}"
            else:
                clean_name = name
                
            if clean_name.startswith(q) or name.startswith(q):
                starts.append(mid)
            elif q in clean_name or q in name:
                contains.append(mid)

        def by_popularity(mid):
            return -int(self._popularity.get(mid, 0))

        starts.sort(key=by_popularity)
        contains.sort(key=by_popularity)

        out = []
        for mid in (starts + contains)[:limit]:
            out.append(
                {
                    "movie_id": int(mid),
                    "title": self.title_by_id.get(mid, str(mid)),
                    "genres": self.genres_by_id.get(mid, ""),
                }
            )
        return out

    # -- helpers ---------------------------------------------------------
    def resolve_title(self, title):
        """Resolve a free-form title to a rateable ``{movie_id, title, genres}``.

        Returns ``None`` if the title can't be matched to a movie present in
        the model.
        """
        key = normalize_title(title)
        mid = self._id_by_norm_title.get(key)
        if mid is None or mid not in self.movie_pos:
            return None
        return {
            "movie_id": int(mid),
            "title": self.title_by_id.get(mid, str(mid)),
            "genres": self.genres_by_id.get(mid, ""),
        }

    def _top_n(self, ranking, predicted, exclude_mask, n):
        """Select the top-``n`` movies by ``ranking``; report ``predicted``.

        ``ranking`` is the taste-aware score used purely for ordering;
        ``predicted`` is the conventional predicted rating shown to the user.
        A tiny popularity prior breaks near-ties toward recognizable titles.
        """
        scores = ranking.copy()
        if self._counts_by_pos is not None and len(self._counts_by_pos) == len(scores):
            pop_prior = 0.05 * (
                np.log1p(self._counts_by_pos) / np.log1p(self._counts_by_pos.max())
            )
            scores = scores + pop_prior

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
                    # Predicted rating clamped to the MovieLens 0.5–5.0 scale.
                    "score": round(min(5.0, max(0.5, float(predicted[idx]))), 3),
                }
            )
        return results


def get_model():
    """Load and cache the collaborative model singleton (loads on first call)."""
    global _model
    if _model is None:
        logger.info("Initializing collaborative model...")
        _model = _CollabModel()
        logger.info("Collaborative model ready")
    return _model


def is_model_loaded():
    """Return True if the collaborative model has been loaded/cached."""
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


def search_movies(query, limit=8):
    """Search rateable movies by title (returns dicts with movie_id)."""
    return get_model().search_movies(query, limit=limit)


def resolve_title(title):
    """Resolve a free-form title to a rateable movie dict, or None."""
    return get_model().resolve_title(title)
