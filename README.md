# CineMind

CineMind is a Flask-based movie recommendation system that combines three
complementary approaches — content-based filtering, collaborative filtering
via KNN, and collaborative filtering via matrix factorization — behind a
small JSON API and a set of server-rendered pages. Movie posters are fetched
on demand from the TMDB API.

---

## Architecture overview

```
cinemind/
├── app/
│   ├── __init__.py              # Flask application factory
│   ├── routes/
│   │   ├── content_based.py     # home page + /api/recommend/content
│   │   ├── collaborative.py     # /show_recommendation + /api/recommend/collaborative
│   │   └── api.py               # /api/recommend/hybrid, /api/search, /health
│   ├── services/
│   │   ├── content_recommender.py   # TF-IDF + KNN model (cached singleton)
│   │   ├── collab_recommender.py    # precomputed KNN / matrix lookups
│   │   └── poster_service.py        # TMDB poster fetching + in-memory cache
│   ├── models/
│   └── templates/               # index, content_based_recommendation, portfolio-details
├── data/
│   ├── raw/                     # movies.csv, ratings.csv
│   ├── processed/               # content_based_final_data_train.csv
│   └── precomputed/             # knn_recommendations.csv, matrix_recommendations.csv
├── notebooks/                   # 01 content-based, 02 KNN, 03 matrix factorization
├── tests/                       # pytest suite
├── run.py                       # entry point
├── config.py                    # dev / prod configuration + data paths
├── requirements.txt
├── .gitignore
└── README.md
```

The app is built with the **application-factory** pattern (`create_app()` in
`app/__init__.py`), which registers three blueprints. Recommendation logic
lives in `app/services/` and is kept independent of Flask so it can be tested
directly. The content-based model is loaded once into a module-level singleton
(`get_model()`), so it is built a single time at first use rather than on every
request.

---

## The three recommendation approaches

### 1. Content-based filtering (`content_recommender.py`)
Uses the preprocessed TMDB 5000 dataset
(`data/processed/content_based_final_data_train.csv`). Each movie has a
`combined_features` text field (genres, keywords, cast, crew, overview, etc.).
A `TfidfVectorizer` turns these into TF-IDF vectors and a `NearestNeighbors`
model (cosine distance, brute force) finds the most similar movies. Lookups
support exact title matches and a fuzzy substring fallback (so `"incept"`
resolves to `Inception`).

### 2. Collaborative filtering — KNN (`collab_recommender.py`)
Per-user recommendations are **precomputed** in
`notebooks/02_knn_collaborative.ipynb` from the MovieLens-style
`ratings.csv` and stored in `data/precomputed/knn_recommendations.csv`
(one row per user, 10 recommendations each). At request time the service
simply looks up the row for the given user ID.

### 3. Collaborative filtering — matrix factorization (`collab_recommender.py`)
Same idea as the KNN approach, but recommendations come from a matrix
factorization model trained in
`notebooks/03_matrix_factorization.ipynb` and stored in
`data/precomputed/matrix_recommendations.csv`.

Both collaborative approaches cover user IDs **1–610**.

> The ML algorithms themselves are unchanged from the original project; the
> refactor focused on structure, caching, robustness, and the API surface.

---

## Setup

Requires **Python 3.9+**.

```bash
# 1. Clone
git clone https://github.com/amanadhav/Cinemind.git
cd Cinemind

# 2. (Recommended) create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Provide a TMDB API key (used for poster images)
#    Create a .env file in the project root:
echo "TMDB_API_KEY=your_tmdb_key_here" > .env

# 5. Run the app
python run.py
```

The server starts on `http://0.0.0.0:5000`. Open
`http://localhost:5000/homepage` for the UI.

### About the TMDB API key
`TMDB_API_KEY` is read from the environment (via a `.env` file, loaded by
`python-dotenv`). It is **never hardcoded**. If the key is missing, poster
lookups gracefully fall back to a placeholder image, so the app still runs.

### Running the tests
```bash
pytest
```

---

## API endpoint reference

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| GET | `/homepage` | – | Server-rendered home page |
| POST | `/content_based` | form: `movie_name` | Server-rendered content-based results page |
| POST | `/show_recommendation` | form: `user_id` | Server-rendered collaborative results page |
| POST | `/api/recommend/content` | `{"movie": "Inception"}` | JSON content-based recommendations |
| POST | `/api/recommend/collaborative` | `{"user_id": 42}` | JSON KNN + matrix recommendations |
| POST | `/api/recommend/hybrid` | `{"movie": "Inception", "user_id": 42}` | Merged content + collaborative results |
| GET | `/api/search` | `?q=inc` | Autocomplete: matching movie titles |
| GET | `/health` | – | Health check + model-loaded status |

### `POST /api/recommend/content`
```json
// request
{ "movie": "Inception" }

// 200 response
[
  { "title": "Inception", "poster_url": "https://image.tmdb.org/t/p/w500/..." },
  { "title": "The Prestige", "poster_url": "https://image.tmdb.org/t/p/w500/..." }
]
```
- `400` if `movie` is missing.
- `404` if the movie is not found in the dataset.

### `POST /api/recommend/collaborative`
```json
// request
{ "user_id": 42 }

// 200 response
{
  "knn_results":    [ { "title": "...", "poster_url": "..." } ],
  "matrix_results": [ { "title": "...", "poster_url": "..." } ]
}
```
- `400` if `user_id` is not an integer or is outside **1–610**.

### `POST /api/recommend/hybrid`
```json
// request
{ "movie": "Inception", "user_id": 42 }

// 200 response (top 10)
[
  { "title": "Inception", "poster_url": "...", "source": "content" },
  { "title": "The Dark Knight (2008)", "poster_url": "...", "source": "both" }
]
```
Content and collaborative results are interleaved and de-duplicated by a
normalized title key. Each item is tagged `content`, `collaborative`, or
`both`; titles recommended by both sources are promoted to the front.
- `400` if `movie` is missing or `user_id` is invalid.

### `GET /api/search?q=inc`
```json
// 200 response
["An Inconvenient Truth", "Basic Instinct 2", "Cinco De Mayo: La Batalla", "..."]
```
Returns up to 10 matching titles. An empty query returns `[]`.

### `GET /health`
```json
{ "status": "ok", "model_loaded": true }
```
`model_loaded` reflects whether the content-based model singleton has been
initialized yet.

---

## Configuration

`config.py` exposes `DevelopmentConfig` and `ProductionConfig` (selected via
the `FLASK_ENV` environment variable, defaulting to production-safe settings)
along with resolved paths to the data files. `run.py` launches the app with
`host="0.0.0.0"`, `port=5000`, and `debug=False`.

---

## Notebooks

The `notebooks/` directory contains the exploratory and training work behind
the models:

- `01_content_based_tmdb.ipynb` — builds the processed content-based dataset.
- `02_knn_collaborative.ipynb` — trains KNN collaborative filtering and writes `knn_recommendations.csv`.
- `03_matrix_factorization.ipynb` — trains matrix factorization and writes `matrix_recommendations.csv`.
