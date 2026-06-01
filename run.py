"""CineMind application entry point."""
from dotenv import load_dotenv

# Load environment variables from a .env file (e.g. TMDB_API_KEY) if present.
load_dotenv()

from app import create_app

app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
