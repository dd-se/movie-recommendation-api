from datetime import date
from typing import Any

import requests
from pydantic import BaseModel, ConfigDict, model_validator


class TMDBMovieData(BaseModel):
    """Validation model for transforming TMDB API data for storage."""

    model_config = ConfigDict(str_strip_whitespace=True, str_min_length=1)

    tmdb_id: int
    title: str
    status: str | None = None
    release_date: date | None = None
    poster_path: str | None = None
    runtime: int | None = None
    overview: str | None = None
    popularity: float | None = None
    vote_average: float | None = None
    vote_count: int | None = None
    genres: str | None = None
    spoken_languages: str | None = None
    production_companies: str | None = None
    production_countries: str | None = None
    keywords: str | None = None
    tagline: str | None = None
    cast: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _process_api_data(cls, data: dict) -> Any:
        if not isinstance(data, dict):
            return data

        foi: dict[str, Any] = {}
        foi["tmdb_id"] = data.get("id")
        foi["title"] = data.get("title") or None
        foi["status"] = data.get("status") or None
        foi["release_date"] = data.get("release_date") or None
        foi["poster_path"] = data.get("poster_path") or None
        foi["runtime"] = data.get("runtime")
        foi["overview"] = data.get("overview") or None
        foi["popularity"] = data.get("popularity")
        foi["vote_average"] = data.get("vote_average")
        foi["vote_count"] = data.get("vote_count")
        foi["tagline"] = data.get("tagline") or None

        if genres := data.get("genres"):
            foi["genres"] = ", ".join(g["name"] for g in genres)
        if langs := data.get("spoken_languages"):
            foi["spoken_languages"] = ", ".join(lang["english_name"] for lang in langs)
        if companies := data.get("production_companies"):
            foi["production_companies"] = ", ".join(c["name"] for c in companies)
        if countries := data.get("production_countries"):
            foi["production_countries"] = ", ".join(c["name"] for c in countries)
        if keywords := data.get("keywords"):
            if keywords := keywords.get("keywords"):
                foi["keywords"] = ", ".join(k["name"] for k in keywords)
        if credits := data.get("credits"):
            if actors := credits.get("cast"):
                foi["cast"] = ", ".join(a["name"] for a in actors[:5])

        return foi


class TMDBClient:
    def __init__(self, api_key: str, base_url: str = "https://api.themoviedb.org/3"):
        self._api_key = api_key
        self._base_url = base_url

    def _get(self, url: str, params: dict[str, Any] | None = None) -> requests.Response:
        headers = {"Authorization": f"Bearer {self._api_key}"}
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response

    def fetch_total_pages(self, suffix: str) -> int:
        data = self._get(f"{self._base_url}/movie/{suffix}").json()
        return data.get("total_pages", 0)

    def fetch_now_playing_ids(self, page: int = 1) -> set[int]:
        data = self._get(f"{self._base_url}/movie/now_playing", {"page": page}).json()
        return {movie["id"] for movie in data.get("results", [])}

    def fetch_top_rated_ids(self, page: int = 1) -> set[int]:
        data = self._get(f"{self._base_url}/movie/top_rated", {"page": page}).json()
        return {movie["id"] for movie in data.get("results", [])}

    def fetch_popular_ids(self, page: int = 1) -> set[int]:
        data = self._get(f"{self._base_url}/movie/popular", {"page": page}).json()
        return {movie["id"] for movie in data.get("results", [])}

    def fetch_movie_details(self, tmdb_id: int) -> TMDBMovieData:
        data = self._get(
            f"{self._base_url}/movie/{tmdb_id}",
            {"append_to_response": "keywords,credits"},
        ).json()
        return TMDBMovieData(**data)
