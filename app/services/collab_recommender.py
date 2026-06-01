"""Collaborative filtering recommendation logic.

Reads precomputed per-user recommendations produced by the KNN and matrix
factorization notebooks. Faithful port from Phase 1; refined in later phases.
"""
import pandas as pd

from config import KNN_RECOMMENDATIONS_CSV, MATRIX_RECOMMENDATIONS_CSV

matrix_factorization_df = pd.read_csv(MATRIX_RECOMMENDATIONS_CSV)
knn_df = pd.read_csv(KNN_RECOMMENDATIONS_CSV)


def get_collaborative(user_id):
    """Return precomputed matrix and KNN recommendations for ``user_id``."""
    matrix_data = list(matrix_factorization_df.iloc[user_id - 1])
    knn_data = list(knn_df.iloc[user_id - 1])
    return matrix_data, knn_data
