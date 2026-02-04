import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.neighbors import NearestNeighbors
from flask import Flask, request, render_template
import re

# this function will import dataset, create count matrix and create similarity score matrix
def create_model():
    # import dataset
    # Thid dataset is preprocessed tmdb_5000 dataset
    data = pd.read_csv("content_based_final_data_train.csv")
    # create count matrix
    tf = TfidfVectorizer()
    tfidf_matrix = tf.fit_transform(data["combined_features"])
    # create similarity score matrix
    model = NearestNeighbors(metric="cosine", algorithm="brute")
    model.fit(tfidf_matrix)
    return data, model, tfidf_matrix


# this function will find movies related to choice entered and return list of 16 movies
# in which first movie will be the choice.
def recommend(choice):
    # this try-except block will check whether count matrix is created or not, if not
    # the it will call create_model() function.
    try:
        model.get_params()
    except Exception:
        data, model, count_matrix = create_model()
    # If movie name exactly matches with the name of movie in the data's title column
    # then this block will be executed.
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

    elif data["title"].str.contains(choice).any() == True:

        # getting list of similar movie names as choice.
        similar_names = [str(s) for s in data["title"] if choice in str(s)]
        # sorting the list to get the most matched movie name.
        similar_names.sort()
        # taking the first movie from the sorted similar movie name.
        new_choice = similar_names[0]
        print(new_choice)
        # getting index of the choice from the dataset
        choice_index = data[data["title"] == new_choice].index.values[0]
        # getting distances and indices of 16 mostly related movies with the choice.
        distances, indices = model.kneighbors(
            count_matrix[choice_index], n_neighbors=16
        )
        # creating movie list
        movie_list = [
            data[data.index == i]["original_title"].values[0].title()
            for i in indices.flatten()
        ]

        generate_csv(movie_list[:10])
        return movie_list[:10]

    else:
        return "opps! movie not found in our database"


def generate_csv(recommend_list):
    recommend_list = pd.DataFrame(recommend_list)
    recommend_list_transpose = recommend_list.transpose()
    recommend_list_transpose.to_csv("file3.csv", index=False, header=False)
