# Get Movie Poster from IMDB from the Movie Title
import json
from bs4 import BeautifulSoup
import requests
import os
from PIL import Image
from io import BytesIO


class ImageScraper:
    def beautiful_soup(self, url):
        response = requests.get(url)
        return BeautifulSoup(response.content, "html.parser")

    def get_IMDb_ID(self, title):
        url = f"http://www.imdb.com/find?s=tt&q={title}"
        soup = self.beautiful_soup(url)
        if result := soup.find("a", {"class": "ipc-metadata-list-summary-item__t"}):
            return result.get("href").split("/")[2]
        return None

    def get_movie_info_IMDb(self, title):
        imdb_id = self.get_IMDb_ID(title)
        if not imdb_id:
            return None
        url = f"https://www.imdb.com/title/{imdb_id}/?ref_=fn_tt_tt_1"
        soup = self.beautiful_soup(url)
        return json.loads(
            str(soup.findAll("script", {"type": "application/ld+json"})[0].text)
        )

    def get_poster_url(self, title):
        if movie_info := self.get_movie_info_IMDb(title):
            return movie_info["image"]
        return None

    def download_poster(self, title, dir_name):
        if src := self.get_poster_url(title):
            if not os.path.isdir(dir_name):
                os.mkdir(dir_name)
            response = requests.get(src)
            ext = src.split(".")[-1]
            img = Image.open(BytesIO(response.content))
            img.save(f"{dir_name}/{title}.{ext}")
        else:
            print(f"No poster found for {title}")
