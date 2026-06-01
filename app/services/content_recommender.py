"""Content-based recommendation logic (TF-IDF + KNN cosine similarity).

NOTE: This is a faithful port of the original content_based_app.py from
Phase 1. The model-caching, file3.csv, and try/except bugs are fixed in
Phase 2.
"""
import re

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

from config import CONTENT_TRAIN_CSV


def create_model():
    """Import the dataset, build the TF-IDF matrix and fit a KNN model."""
    data = pd.read_csv(CONTENT_TRAIN_CSV)
    tf = TfidfVectorizer()
    tfidf_matrix = tf.fit_transform(data["combined_features"])
    model = NearestNeighbors(metric="cosine", algorithm="brute")
    model.fit(tfidf_matrix)
    return data, model, tfidf_matrix


def recommend(choice):
    """Find movies related to ``choice`` and return a list of titles."""
    try:
        model.get_params()
    except Exception:
        data, model, count_matrix = create_model()

    choice = re.sub("[^a-zA-Z1-9]", "", choice).lower()
    if choice in data["title"].values:
        choice_index = data[data["title"] == choice].index.values[0]
        distances, indices = model.kneighbors(
            count_matrix[choice_index], n_neighbors=16
        )
        movie_list = [
            data[data.index == i]["original_title"].values[0].title()
            for i in indices.flatten()
        ]
        generate_csv(movie_list[:10])

    elif data["title"].str.contains(choice).any():
        similar_names = [str(s) for s in data["title"] if choice in str(s)]
        similar_names.sort()
        new_choice = similar_names[0]
        choice_index = data[data["title"] == new_choice].index.values[0]
        distances, indices = model.kneighbors(
            count_matrix[choice_index], n_neighbors=16
        )
        movie_list = [
            data[data.index == i]["original_title"].values[0].title()
            for i in indices.flatten()
        ]
        generate_csv(movie_list[:10])
        return movie_list[:10]

    else:
        return "opps! movie not found in our database"


def generate_csv(recommend_list):
    """Write recommendations to file3.csv (removed in Phase 2)."""
    recommend_list = pd.DataFrame(recommend_list)
    recommend_list_transpose = recommend_list.transpose()
    recommend_list_transpose.to_csv("file3.csv", index=False, header=False)
