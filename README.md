# CineMind

**[Live Demo](https://cinemind-prod.vercel.app)**

![CineMind demo](assets/Animation.gif)

I was taking CSE 475 (Machine Learning) this semester and we covered collaborative filtering and matrix factorization. Around the same time I was frustrated that I had no good way to keep track of movies I wanted to watch or find stuff similar to what I already liked - things like Goodfellas, Taxi Driver, that kind of cinema. So I built CineMind to actually use what I was learning on a problem I had.

The core idea: rate a few movies you've seen, get back recommendations that match your taste. Under the hood it's a hybrid of two approaches - SVD matrix factorization on 100k+ MovieLens ratings for the collaborative side, and TF-IDF + cosine similarity over genres, cast, crew and keywords for the content side. New users get handled via a cold-start fold-in so they don't need to exist in the training data.

## How it works

### Content-based filtering
Each movie gets a `combined_features` text field built from its genres, keywords, cast and crew. A `TfidfVectorizer` turns those into vectors and a cosine-distance `NearestNeighbors` model finds the closest titles. Search supports fuzzy matching so `incept` finds `Inception`.

### Collaborative filtering (SVD)
Loads the MovieLens user-item matrix (610 users x 9,724 movies), mean-centers each user's ratings, then factorizes with `scipy.sparse.linalg.svds` at k=50 latent factors. For known users, recommendations come from reconstructing `U * S * Vt` and masking already-rated movies.

For new users (cold start), the ratings you submit get folded into the latent space - `user_latent = r * Vt / S` - so you get personalized picks without retraining anything. The whole factorization runs in about a second at startup and stays in memory.

### Hybrid
Both models produce candidate lists that get interleaved and de-duplicated. Movies that show up in both are promoted to the top and tagged `both`.

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

Both models are loaded once into module-level singletons at startup so requests don't pay any initialization cost.

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Python, Flask, flask-cors, Gunicorn |
| ML / data | scikit-learn (TF-IDF + KNN), SciPy (`svds`), pandas, NumPy |
| Validation | Pydantic v2 |
| External | TMDB API (posters, overviews, backdrops) |
| Testing | pytest (71 tests) |
| Deploy | Railway (API) + Vercel (frontend) |

## Frontend tabs

- **For You** - rate 5+ movies with a star widget, get cold-start SVD picks
- **Discover** - search a movie title, get a grid of similar ones with match badges
- **Mix It** - pick a movie you love and rate a few others, get a blended result grid
- **Movie detail** - click any poster for a TMDB modal with backdrop, overview, runtime and genres

## Setup

Requires Python 3.9+ and Node.js 18+.

```bash
# 1. Clone
git clone https://github.com/amanadhav/Cinemind.git
cd Cinemind

# 2. Backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. TMDB API key
cp .env.example .env             # edit .env and set TMDB_API_KEY

# 4. Run backend (port 5000)
python run.py
```

In a second terminal:

```bash
# 5. Frontend
cd frontend
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                        # port 3000
```

Open http://localhost:3000.

If `TMDB_API_KEY` is missing, poster lookups fall back to placeholders so the app still runs.

### Tests
```bash
pytest
```

## API reference

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| POST | `/api/recommend/content` | `{"movie": "Inception"}` | Content-based similar movies |
| POST | `/api/recommend/collaborative` | `{"user_id": 42}` | SVD picks for a known user |
| POST | `/api/recommend/hybrid` | `{"movie": "...", "ratings": [...]}` | Blended results |
| POST | `/api/rate` | `{"ratings": [{"movie_id": 1, "rating": 4.5}]}` | Cold-start picks |
| GET | `/api/movies/popular` | `?limit=20` | Most-rated movies |
| GET | `/api/movie/<id>` | - | TMDB metadata by MovieLens id |
| GET | `/api/search` | `?q=inc` | Autocomplete |
| GET | `/health` | - | Health check |

## Project structure

```
Cinemind/
├── app/
│   ├── __init__.py              # Flask app factory + CORS + request tracing
│   ├── logging_config.py        # structured logging with correlation ids
│   ├── schemas.py               # Pydantic request schemas
│   ├── errors.py                # JSON error handlers
│   ├── routes/
│   │   ├── recommend.py         # content / collaborative / hybrid
│   │   ├── ratings.py           # /api/rate, /api/movies/popular
│   │   ├── movies.py            # /api/movie/<id>, /api/movie/detail
│   │   └── search.py            # /api/search, /health
│   └── services/
│       ├── content_recommender.py   # TF-IDF + KNN
│       ├── collab_recommender.py    # SVD inference + fold-in
│       └── poster_service.py        # TMDB integration
├── frontend/                    # Next.js 14 + shadcn/ui
├── data/                        # MovieLens raw + processed CSVs
├── notebooks/                   # exploratory notebooks (content, KNN, SVD)
└── tests/                       # pytest suite (71 tests)
```

## Notebooks

`notebooks/` has the exploratory work: `01_content_based_tmdb.ipynb` builds the processed content dataset, `02_knn_collaborative.ipynb` and `03_matrix_factorization.ipynb` are where I worked through the collaborative approaches before moving them into the app.
