"""Content-based recommendation logic (TF-IDF + KNN cosine similarity).

The ML artifacts (training data, fitted KNN model, and TF-IDF matrix) are
cached in module-level singletons via ``get_model()`` so the model is built
once on first use rather than rebuilt on every request.

``recommend()`` returns a Python list of titles directly; there is no
intermediate CSV file (the old file3.csv race condition is gone).
"""
import re

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

from config import CONTENT_TRAIN_CSV

# Module-level singletons. Populated on the first call to get_model().
_model = None
_data = None
_tfidf_matrix = None


def is_model_loaded():
    """Return True if the model singleton has been initialized."""
    return _model is not None


def get_model():
    """Load and cache the dataset, TF-IDF matrix, and fitted KNN model.

    On the first call this reads the processed training data, fits a
    ``TfidfVectorizer`` over the ``combined_features`` column, and fits a
    cosine-distance ``NearestNeighbors`` model. Subsequent calls return the
    cached artifacts.

    Returns:
        Tuple of (data DataFrame, fitted NearestNeighbors model, tfidf matrix).
    """
    global _model, _data, _tfidf_matrix
    if _model is None:
        data = pd.read_csv(CONTENT_TRAIN_CSV)
        tf = TfidfVectorizer()
        tfidf_matrix = tf.fit_transform(data["combined_features"])
        model = NearestNeighbors(metric="cosine", algorithm="brute")
        model.fit(tfidf_matrix)
        _data, _model, _tfidf_matrix = data, model, tfidf_matrix
    return _data, _model, _tfidf_matrix


def recommend(choice, n_results=10):
    """Recommend movies similar to ``choice``.

    Performs an exact title match first, then falls back to a fuzzy
    (substring) match. The matched movie itself is included as the first
    item, consistent with the original behaviour.

    Args:
        choice: The movie title entered by the user.
        n_results: Number of recommendations to return (default 10).

    Returns:
        A list of recommended movie titles, or the string
        ``"opps! movie not found in our database"`` when no match is found.
    """
    data, model, tfidf_matrix = get_model()

    # Normalize the query the same way the stored titles were normalized.
    choice = re.sub("[^a-zA-Z1-9]", "", choice).lower()

    if choice in data["title"].values:
        match_title = choice
    elif data["title"].str.contains(choice, regex=False).any():
        # Fuzzy match: pick the first alphabetically-sorted substring match.
        similar_names = sorted(str(s) for s in data["title"] if choice in str(s))
        match_title = similar_names[0]
    else:
        return "opps! movie not found in our database"

    choice_index = data[data["title"] == match_title].index.values[0]
    # Request one extra neighbour so we can still return n_results.
    distances, indices = model.kneighbors(
        tfidf_matrix[choice_index], n_neighbors=n_results + 6
    )
    movie_list = [
        data[data.index == i]["original_title"].values[0].title()
        for i in indices.flatten()
    ]
    return movie_list[:n_results]


def search_titles(query, limit=10):
    """Return up to ``limit`` movie titles matching ``query`` (substring).

    Matches case-insensitively against the human-readable ``original_title``
    column and returns title-cased, de-duplicated names sorted
    alphabetically. Used by the search/autocomplete endpoint.
    """
    query = str(query).strip().lower()
    if not query:
        return []

    data, _model, _tfidf_matrix = get_model()
    matches = []
    seen = set()
    for original_title in data["original_title"]:
        name = str(original_title)
        if query in name.lower():
            display = name.title()
            if display not in seen:
                seen.add(display)
                matches.append(display)
    matches.sort()
    return matches[:limit]
