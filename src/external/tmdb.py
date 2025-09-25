import os

import requests
from requests import Response

from ..validation.models import MovieCreate

TMDB_API_KEY = os.environ["TMDB_API_KEY"]
TMDB_BASE_URL = "https://api.themoviedb.org/3"
HEADERS = {"Authorization": f"Bearer {TMDB_API_KEY}"}


def call_external_api(url: str, query_params: dict):
    response = requests.get(url, params=query_params, headers=HEADERS)
    response.raise_for_status()
    return response


def fetch_total_pages(suffix: str) -> set[int]:
    """Fetch now playing TMDB ID's from TMDB"""
    url = f"{TMDB_BASE_URL}/movie/{suffix}"
    data: dict = call_external_api(url, None).json()
    results = data.get("total_pages")
    return results


def fetch_now_playing_tmdb_ids(page: int = 1) -> set[int]:
    """Fetch now playing TMDB ID's from TMDB"""
    url = f"{TMDB_BASE_URL}/movie/now_playing"
    params = {"page": page}
    data: dict = call_external_api(url, params).json()
    results = data.get("results")
    return {movie["id"] for movie in results}


def fetch_top_rated_tmdb_ids(page: int = 1) -> set[int]:
    """Fetch highly rated TMDB ID's from TMDB"""
    url = f"{TMDB_BASE_URL}/movie/top_rated"
    params = {"page": page}
    data: dict = call_external_api(url, params).json()
    results = data.get("results")
    return {movie["id"] for movie in results}


def fetch_popular_tmdb_ids(page: int = 1) -> set[int]:
    """Fetch popular TMDB ID's from TMDB"""
    url = f"{TMDB_BASE_URL}/movie/popular"
    params = {"page": page}
    data: dict = call_external_api(url, params).json()
    results = data.get("results")
    return {movie["id"] for movie in results}


def fetch_movie_details(tmdb_id: int) -> MovieCreate:
    """Fetch detailed movie data including keywords and credits from TMDB"""
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}"
    params = {"append_to_response": "keywords,credits"}
    data: dict = call_external_api(url, params).json()
    validated_movie = MovieCreate(**data)
    return validated_movie
