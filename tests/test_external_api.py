import pytest
from requests import RequestException

from backend.infrastructure.external.tmdb_client import TMDBClient


@pytest.fixture
def tmdb_client(mock_external_api_requests):
    return TMDBClient(api_key="test_api_key")


def test_fetch_movie_details(tmdb_client):
    movie = tmdb_client.fetch_movie_details(272)
    assert movie.tmdb_id == 272
    assert movie.title == "Batman Begins"
    assert movie.status == "Released"
    assert movie.genres == "Drama, Crime, Action"
    assert movie.spoken_languages == "English, Urdu, Mandarin"

    movies = tmdb_client.fetch_popular_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    movies = tmdb_client.fetch_now_playing_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    movies = tmdb_client.fetch_top_rated_ids()
    assert isinstance(movies, set)
    assert len(movies) > 0
    assert all(isinstance(id, int) for id in movies)

    with pytest.raises(RequestException):
        tmdb_client.fetch_movie_details(99999999)
