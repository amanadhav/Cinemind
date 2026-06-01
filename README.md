# CineMind

**[Live Demo](https://cinemind.vercel.app)**

CineMind is a full-stack movie recommendation system. It combines **content-based
filtering** (TF-IDF over genres, keywords, cast and crew with cosine-similarity
nearest neighbors) and **collaborative filtering** (SVD matrix factorization over
100,836 MovieLens ratings from 610 users). New visitors get personalized picks
through a **cold-start fold-in** — their ad-hoc ratings are projected into the
trained latent space at request time, with no model retraining. A **Next.js +
shadcn/ui** frontend talks to a **Flask** JSON API, and movie posters and
metadata are enriched live from the **TMDB API**.

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │      Next.js 14 (Vercel)      │
   User  ───────────────▶│  shadcn/ui · Tailwind · TS    │
                         │  For You · Discover · Mix It  │
                         └───────────────┬───────────────┘
                                         │  fetch() JSON / CORS
                                         ▼
                         ┌──────────────────────────────┐
                         │      Flask REST API (Railway) │
                         │  /api/recommend/* · /api/rate  │
                         │  /api/movies/* · /api/search   │
                         └───┬───────────┬───────────┬────┘
                             │           │           │
                  ┌──────────▼──┐  ┌─────▼──────┐  ┌─▼───────────┐
                  │  SVD model  │  │ TF-IDF +   │  │  TMDB API   │
                  │ (SciPy svds │  │   KNN      │  │ posters +   │
                  │  k=50,      │  │ (scikit-   │  │ metadata    │
                  │  fold-in)   │  │  learn)    │  │             │
                  └─────────────┘  └────────────┘  └─────────────┘
```

Both ML models are loaded once into module-level singletons at startup
(`run.py` warms them up), so requests never pay the training cost.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Python, Flask, flask-cors, Gunicorn |
| ML / data | scikit-learn (TF-IDF + KNN), SciPy (`svds`), pandas, NumPy |
| External | TMDB API (posters, overviews, backdrops) |
| Testing | pytest (51 tests) |
| Deploy | Railway (API) + Vercel (frontend) |

---

## The recommendation engine

### Content-based (`app/services/content_recommender.py`)
Each movie has a `combined_features` text field (genres, keywords, cast, crew,
overview). A `TfidfVectorizer` turns these into vectors and a cosine-distance
`NearestNeighbors` model finds the most similar titles. Exact and fuzzy
substring matching resolve user queries (e.g. `incept` → `Inception`).

### Collaborative — real-time SVD (`app/services/collab_recommender.py`)
At startup the service builds a 610 × 9,724 user-item matrix from
`ratings.csv`, mean-centers each user's ratings, and factorizes it with
`scipy.sparse.linalg.svds` (50 latent factors) in ~1 second.

- **Known users:** predicted ratings are reconstructed from `U · Σ · Vᵀ`,
  already-rated movies are masked out, and the top-N remaining are returned.
- **New users (cold start):** the ratings a visitor submits are folded into the
  latent space — `user_latent = r · Vᵀ / Σ` — then reconstructed into predicted
  scores. No retraining is required, so recommendations are instant.

### Hybrid
Content and collaborative candidate lists are interleaved, de-duplicated by a
normalized title key, and each result is tagged `content`, `collaborative`, or
`both` (titles found by both sources are promoted to the top).

---

## Frontend features

- **For You** — rate 5+ popular movies with a star widget, get personalized
  picks via the cold-start fold-in.
- **Discover by Movie** — debounced autocomplete search, then a grid of similar
  movies with match-rank badges and skeleton loading states.
- **Mix It** — pick a movie you love *and* rate a few others; results are a
  blended grid with colored source badges.
- **Movie detail dialog** — click any poster for a TMDB-powered modal (backdrop,
  overview, runtime, genres) with a "Find Similar" action.
- **How it works** — a collapsible explainer of the three approaches.

---

## Setup

Requires **Python 3.9+** and **Node.js 18+**.

```bash
# 1. Clone
git clone https://github.com/amanadhav/Cinemind.git
cd Cinemind

# 2. Backend: virtual environment + dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Provide a TMDB API key (used for posters + metadata)
cp .env.example .env             # then edit .env and set TMDB_API_KEY

# 4. Run the backend (port 5000)
python run.py
```

In a second terminal:

```bash
# 5. Frontend
cd frontend
cp .env.local.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                       # port 3000
```

Open http://localhost:3000.

### About the TMDB API key
`TMDB_API_KEY` (a TMDB **v3** API key) is read from the environment via a
`.env` file and is never hardcoded. If it is missing, poster and metadata
lookups fall back to placeholders so the app still runs.

### Running the tests
```bash
pytest
```

---

## API reference

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| POST | `/api/recommend/content` | `{"movie": "Inception"}` | Content-based similar movies |
| POST | `/api/recommend/collaborative` | `{"user_id": 42}` | Real-time SVD picks for a known user |
| POST | `/api/recommend/hybrid` | `{"movie": "...", "user_id": 42}` or `{"movie": "...", "ratings": [...]}` | Blended content + collaborative results |
| POST | `/api/rate` | `{"ratings": [{"movie_id": 1, "rating": 4.5}]}` | Cold-start picks from ad-hoc ratings |
| GET | `/api/movies/popular` | `?limit=20` | Most-rated movies (seeds the rating UI) |
| GET | `/api/movie/<id>` | – | Full TMDB metadata for a MovieLens id |
| GET | `/api/movie/detail` | `?title=Inception` | Full TMDB metadata by title |
| GET | `/api/search` | `?q=inc` | Autocomplete over movie titles |
| GET | `/health` | – | Health check + model-loaded status |

### Example responses

`POST /api/rate`
```json
{
  "recommendations": [
    {
      "movie_id": 3114, "title": "Toy Story 2 (1999)",
      "genres": "Adventure|Animation|Children|Comedy|Fantasy",
      "score": 4.72, "poster_url": "https://image.tmdb.org/t/p/w500/..."
    }
  ]
}
```

`POST /api/recommend/hybrid`
```json
[
  { "title": "Inception", "poster_url": "...", "source": "content" },
  { "title": "The Matrix (1999)", "poster_url": "...", "source": "both" }
]
```

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step Railway (backend) and
Vercel (frontend) instructions.

---

## Project structure

```
Cinemind/
├── app/
│   ├── __init__.py              # Flask app factory + CORS
│   ├── routes/
│   │   ├── recommend.py         # content / collaborative / hybrid
│   │   ├── ratings.py           # /api/rate, /api/movies/popular
│   │   ├── movies.py            # /api/movie/<id>, /api/movie/detail
│   │   └── search.py            # /api/search, /health
│   └── services/
│       ├── content_recommender.py   # TF-IDF + KNN (cached singleton)
│       ├── collab_recommender.py    # real-time SVD inference + fold-in
│       └── poster_service.py        # TMDB posters + metadata + cache
├── frontend/                    # Next.js 14 + shadcn/ui
│   ├── app/                     # layout, home page, globals.css
│   ├── components/              # tabs, dialog, cards, ui/ primitives
│   └── lib/                     # typed API client + utils
├── data/                        # MovieLens raw + processed CSVs
├── notebooks/                   # content, KNN, matrix-factorization notebooks
├── tests/                       # pytest suite (51 tests)
├── config.py · run.py · Procfile · requirements.txt · DEPLOYMENT.md
```

---

## Notebooks

The `notebooks/` directory holds the exploratory and training work:
`01_content_based_tmdb.ipynb` builds the processed content dataset;
`02_knn_collaborative.ipynb` and `03_matrix_factorization.ipynb` explore the
collaborative approaches. The production app trains its SVD model directly from
the raw ratings at startup.
