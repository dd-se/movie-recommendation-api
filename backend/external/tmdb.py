import os

import requests

from ..schemas.movie import MovieCreate

TMDB_API_KEY = os.environ["TMDB_API_KEY"]
TMDB_BASE_URL = "https://api.themoviedb.org/3"
HEADERS = {"Authorization": f"Bearer {TMDB_API_KEY}"}


def call_external_api(url: str, query_params: dict | None) -> requests.Response:
    response = requests.get(url, params=query_params, headers=HEADERS)
    response.raise_for_status()
    return response


def fetch_total_pages(suffix: str) -> int:
    url = f"{TMDB_BASE_URL}/movie/{suffix}"
    data: dict = call_external_api(url, None).json()
    return data.get("total_pages", 0)


def fetch_now_playing_tmdb_ids(page: int = 1) -> set[int]:
    url = f"{TMDB_BASE_URL}/movie/now_playing"
    data: dict = call_external_api(url, {"page": page}).json()
    return {movie["id"] for movie in data.get("results", [])}


def fetch_top_rated_tmdb_ids(page: int = 1) -> set[int]:
    url = f"{TMDB_BASE_URL}/movie/top_rated"
    data: dict = call_external_api(url, {"page": page}).json()
    return {movie["id"] for movie in data.get("results", [])}


def fetch_popular_tmdb_ids(page: int = 1) -> set[int]:
    url = f"{TMDB_BASE_URL}/movie/popular"
    data: dict = call_external_api(url, {"page": page}).json()
    return {movie["id"] for movie in data.get("results", [])}


def fetch_movie_details(tmdb_id: int) -> MovieCreate:
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}"
    data: dict = call_external_api(url, {"append_to_response": "keywords,credits"}).json()
    return MovieCreate(**data)
