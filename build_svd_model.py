"""Offline SVD trainer for CineMind collaborative filtering.

Runs the truncated-SVD matrix factorization **once on your local machine**
(where there is enough RAM to hold the 25M ratings), then saves only the
compact trained artifacts needed at request time:

  * ``Vt``            — item latent-factor matrix (k x n_movies), float32
  * ``sigma``         — singular values (k,)
  * ``movie_ids``     — MovieLens ids defining the column order of ``Vt``
  * ``rating_counts`` — per-movie rating count (popularity), aligned to ids
  * ``movie_means``   — per-movie average rating (item bias), aligned to ids
  * ``global_mean``   — global average rating (fold-in baseline)
  * ``max_user_id``   — highest MovieLens user id (for id validation)

The production service loads this ~12-15 MB ``.npz`` instead of the 646 MB
ratings file, dropping peak memory from ~2 GB to ~50 MB. The cold-start
"rate a few movies" fold-in only needs ``Vt`` + ``sigma``, so recommendation
quality is fully preserved.

Usage:
    python build_svd_model.py

Reads ratings from ``data/raw/ratings.csv`` (or ``ratings.csv.gz``) and writes
``data/processed/svd_model.npz``.
"""
import gzip
import os
import sys
import time

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

from config import RATINGS_CSV, PROCESSED_DATA_DIR

N_FACTORS = 100
# Movies with fewer than this many ratings are dropped before training. The
# MovieLens 25M long tail is enormous (~45% of movies have < 50 ratings, many
# just 1), and those columns contribute only noise to the factorization while
# polluting recommendations. Keeping a solid floor yields cleaner latent
# factors, a smaller model, and far more relevant picks.
MIN_RATINGS_PER_MOVIE = 50
OUTPUT_PATH = os.path.join(PROCESSED_DATA_DIR, "svd_model.npz")


def load_ratings():
    """Load ratings from the raw CSV or its gzip-compressed sibling."""
    gz = RATINGS_CSV + ".gz"
    if os.path.isfile(RATINGS_CSV):
        print(f"Reading {RATINGS_CSV} ...")
        return pd.read_csv(RATINGS_CSV)
    if os.path.isfile(gz):
        print(f"Reading {gz} (compressed) ...")
        with gzip.open(gz, "rt") as fh:
            return pd.read_csv(fh)
    sys.exit(
        f"ERROR: no ratings file found at {RATINGS_CSV} or {gz}. "
        "Download MovieLens ml-25m and place ratings.csv under data/raw/."
    )


def main():
    t0 = time.time()
    ratings = load_ratings()
    print(f"  loaded {len(ratings):,} ratings in {time.time() - t0:.1f}s")

    # --- Drop the long tail of rarely-rated movies -----------------------
    # Movies with very few ratings produce noisy latent factors and dominate
    # cold-start results with obscure titles. Keep only movies with enough
    # signal to be modeled reliably.
    counts_all = ratings.groupby("movieId").size()
    keep_ids = set(counts_all[counts_all >= MIN_RATINGS_PER_MOVIE].index)
    before = ratings["movieId"].nunique()
    ratings = ratings[ratings["movieId"].isin(keep_ids)]
    print(
        f"  kept {len(keep_ids):,} / {before:,} movies "
        f"(>= {MIN_RATINGS_PER_MOVIE} ratings); {len(ratings):,} ratings remain"
    )

    # Stable column ordering by movieId.
    movie_ids = np.sort(ratings["movieId"].unique())
    user_ids = np.sort(ratings["userId"].unique())
    movie_pos = {mid: i for i, mid in enumerate(movie_ids)}
    user_pos = {uid: i for i, uid in enumerate(user_ids)}
    n_users, n_movies = len(user_ids), len(movie_ids)
    print(f"  {n_users:,} users x {n_movies:,} movies")

    # Per-movie popularity (rating count) and mean rating, aligned to ids.
    grouped = ratings.groupby("movieId")["rating"]
    counts_series = grouped.size()
    means_series = grouped.mean()
    rating_counts = np.array(
        [int(counts_series.get(mid, 0)) for mid in movie_ids], dtype=np.int64
    )
    movie_means = np.array(
        [float(means_series.get(mid, 0.0)) for mid in movie_ids], dtype=np.float64
    )

    # Global mean rating across the whole dataset (the baseline for fold-in).
    global_mean = float(ratings["rating"].mean())
    print(f"  global mean rating: {global_mean:.3f}")

    # Sparse user-item matrix.
    print("Building sparse matrix ...")
    rows = ratings["userId"].map(user_pos).to_numpy()
    cols = ratings["movieId"].map(movie_pos).to_numpy()
    vals = ratings["rating"].to_numpy(dtype=np.float64)
    matrix = csr_matrix((vals, (rows, cols)), shape=(n_users, n_movies))

    # Mean-center each user's ratings over their rated items only.
    print("Mean-centering ...")
    rated_counts = np.diff(matrix.indptr)
    sums = np.array(matrix.sum(axis=1)).flatten()
    user_means = np.divide(
        sums, rated_counts, out=np.zeros_like(sums), where=rated_counts > 0
    )
    demeaned = matrix.copy()
    demeaned.data = demeaned.data.copy()
    for i in range(n_users):
        if user_means[i] != 0:
            demeaned.data[demeaned.indptr[i]:demeaned.indptr[i + 1]] -= user_means[i]

    # Truncated SVD.
    k = min(N_FACTORS, min(demeaned.shape) - 1)
    print(f"Running truncated SVD (k={k}) ... this is the slow part")
    ts = time.time()
    u, sigma, vt = svds(demeaned, k=k)
    order = np.argsort(sigma)[::-1]
    sigma = sigma[order]
    vt = vt[order, :]
    print(f"  SVD done in {time.time() - ts:.1f}s")

    # Save compact artifacts. Vt as float32 halves the file size with no
    # meaningful loss for recommendation ranking.
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    np.savez_compressed(
        OUTPUT_PATH,
        Vt=vt.astype(np.float32),
        sigma=sigma.astype(np.float64),
        movie_ids=movie_ids.astype(np.int64),
        rating_counts=rating_counts,
        movie_means=movie_means.astype(np.float32),
        global_mean=np.float64(global_mean),
        max_user_id=np.int64(user_ids[-1]),
    )
    size_mb = os.path.getsize(OUTPUT_PATH) / 1e6
    print(f"\nSaved {OUTPUT_PATH} ({size_mb:.1f} MB)")
    print(f"Total time: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
