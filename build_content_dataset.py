"""
Rebuild content_based_final_data_train.csv from the ML-25M movies.csv.

The original file was built from tmdb_5000_movies with rich features
(genres, keywords, cast, crew, overview). ML-25M only has genres, so we
use genres as the feature signal — still effective for content-based
similarity since genre combinations are highly discriminative.

Output format (matches what content_recommender.py expects):
    original_title, combined_features, title

- original_title: human-readable title (e.g. "Toy Story")
- combined_features: space-joined genre words, lowercased, no special chars
- title: normalized title used as lookup key (same normalization as recommender)
"""
import re
import pandas as pd

MOVIES_IN  = "data/raw/movies.csv"
OUTPUT_CSV = "data/processed/content_based_final_data_train.csv"


def normalize_title(title: str) -> str:
    """Mirror the normalization in content_recommender.py:
    strip year, remove non-alphanumeric, lowercase.
    """
    # Strip trailing year "(YYYY)"
    text = re.sub(r"\s*\(\d{4}\)\s*$", "", str(title)).strip()
    # Move trailing article: "Matrix, The" -> "the matrix"
    m = re.match(r"^(.*),\s+(The|A|An)$", text, flags=re.IGNORECASE)
    if m:
        text = f"{m.group(2)} {m.group(1)}"
    return re.sub(r"[^a-zA-Z1-9]", "", text).lower()


def genres_to_features(genres_str: str, title: str) -> str:
    """Convert pipe-separated genres + year extracted from title to features.
    E.g. "Action|Adventure|Sci-Fi" + "Inception (2010)" -> "action adventure scifi year2010"
    Adding the year means movies with identical genres (e.g. two romcoms) get
    slightly different vectors, so era-similar films cluster together.
    """
    parts = []
    if isinstance(genres_str, str) and genres_str != "(no genres listed)":
        for g in genres_str.split("|"):
            cleaned = re.sub(r"[^a-zA-Z0-9]", "", g).lower()
            if cleaned:
                parts.append(cleaned)

    # Extract year from title like "Movie Name (2018)"
    # Add year token twice so it influences similarity but doesn't dominate —
    # a 2018 romcom should still match a 2015 romcom over a 2018 thriller.
    year_match = re.search(r"\((\d{4})\)\s*$", str(title))
    if year_match:
        year = f"year{year_match.group(1)}"
        parts.append(year)  # added once (lighter weight than genres)

    return " ".join(parts)


def main():
    print(f"Reading {MOVIES_IN}...")
    movies = pd.read_csv(MOVIES_IN)
    print(f"  Loaded {len(movies):,} movies")

    # Build output rows
    rows = []
    skipped = 0
    for _, row in movies.iterrows():
        original_title = str(row["title"]).strip()
        features = genres_to_features(row.get("genres", ""), original_title)

        # Skip movies with no genre info — they can't be matched by content
        if not features:
            skipped += 1
            continue

        norm_title = normalize_title(original_title)
        if not norm_title:
            skipped += 1
            continue

        rows.append({
            "original_title": original_title,
            "combined_features": features,
            "title": norm_title,
        })

    print(f"  Skipped {skipped:,} movies with no genre data")
    print(f"  Writing {len(rows):,} movies to {OUTPUT_CSV}...")

    out = pd.DataFrame(rows, columns=["original_title", "combined_features", "title"])

    # Drop duplicate normalized titles — keep the one with more genre words
    out["_feat_len"] = out["combined_features"].str.len()
    out = out.sort_values("_feat_len", ascending=False)
    out = out.drop_duplicates(subset="title", keep="first")
    out = out.drop(columns=["_feat_len"])

    out.to_csv(OUTPUT_CSV, index=False)
    print(f"Done. {len(out):,} unique movies written.")
    print(f"\nSample:\n{out.head(3).to_string()}")


if __name__ == "__main__":
    main()
