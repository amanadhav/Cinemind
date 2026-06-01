"""Collaborative filtering recommendation logic.

Reads precomputed per-user recommendations produced by the KNN and matrix
factorization notebooks. The precomputed CSVs cover user IDs 1..610.
"""
import pandas as pd

from config import KNN_RECOMMENDATIONS_CSV, MATRIX_RECOMMENDATIONS_CSV

matrix_factorization_df = pd.read_csv(MATRIX_RECOMMENDATIONS_CSV)
knn_df = pd.read_csv(KNN_RECOMMENDATIONS_CSV)

# Valid (inclusive) range of user IDs supported by the precomputed data.
MIN_USER_ID = 1
MAX_USER_ID = 610


def is_valid_user_id(user_id):
    """Return True if ``user_id`` is an int within the supported range."""
    return isinstance(user_id, int) and MIN_USER_ID <= user_id <= MAX_USER_ID


def get_collaborative(user_id):
    """Return precomputed matrix and KNN recommendations for ``user_id``."""
    matrix_data = list(matrix_factorization_df.iloc[user_id - 1])
    knn_data = list(knn_df.iloc[user_id - 1])
    return matrix_data, knn_data
