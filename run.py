"""CineMind backend API entry point."""
import os

from dotenv import load_dotenv

# Load environment variables from a .env file (e.g. TMDB_API_KEY) if present.
load_dotenv()

from app import create_app
from app.services import collab_recommender, content_recommender

app = create_app()

# Warm up both models at startup so the first request isn't slow. The SVD
# factorization runs once here (~1s for MovieLens 100K).
with app.app_context():
    collab_recommender.get_model()
    content_recommender.get_model()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
