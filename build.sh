#!/bin/bash
# Download ML-25M dataset if ratings.csv is missing (happens on first Railway build).
# This keeps the 646MB file out of git while ensuring production has the data.

if [ ! -f data/raw/ratings.csv ]; then
  echo "📥 Downloading ML-25M dataset (646 MB)..."
  curl -L https://files.grouplens.org/datasets/movielens/ml-25m.zip -o ml-25m.zip
  
  echo "📦 Extracting ratings.csv..."
  unzip -j ml-25m.zip ml-25m/ratings.csv -d data/raw/
  
  echo "🧹 Cleaning up..."
  rm ml-25m.zip
  
  echo "✅ ML-25M dataset ready"
else
  echo "✅ ratings.csv already present, skipping download"
fi

# Rebuild the content dataset from the 25M movies.csv if needed
if [ ! -f data/processed/content_based_final_data_train.csv ]; then
  echo "🔨 Building content recommendation dataset..."
  python build_content_dataset.py
fi
