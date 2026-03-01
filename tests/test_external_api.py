import pytest
from requests import RequestException

from backend.external.tmdb import (
    fetch_movie_details,
    fetch_now_playing_tmdb_ids,
    fetch_popular_tmdb_ids,
    fetch_top_rated_tmdb_ids,
)


def test_fetch_movie_details(mock_external_api_requests):
    movie = fetch_movie_details(272)
    assert movie.tmdb_id == 272
    assert movie.title == "Batman Begins"
    assert movie.status == "Released"
    assert movie.genres == "Drama, Crime, Action"
    assert movie.spoken_languages == "English, Urdu, Mandarin"

    movies = fetch_popular_tmdb_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    movies = fetch_now_playing_tmdb_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    movies = fetch_top_rated_tmdb_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    with pytest.raises(RequestException):
        fetch_movie_details(99999999)
