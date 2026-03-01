from datetime import date

import pytest
from pydantic import ValidationError

from backend.schemas import MovieCreate


def test_valid_movie_create(example_response):
    """Test creating a MovieCreate instance with valid data."""

    movie = MovieCreate(**example_response)
    assert movie.tmdb_id == 272
    assert movie.title == "Batman Begins"
    assert movie.spoken_languages == "English, Urdu, Mandarin"
    assert movie.is_my_kind_of_movie()


def test_none_fields():
    """Test handling of None values for optional fields."""
    data = {
        "id": 8,
        "title": "Test Movie",
        "status": None,
        "release_date": None,
        "overview": None,
        "popularity": None,
        "runtime": None,
        "vote_average": None,
        "vote_count": None,
        "genres": None,
        "spoken_languages": None,
        "production_companies": None,
        "production_countries": None,
        "keywords": None,
        "tagline": None,
        "cast": None,
    }
    movie = MovieCreate(**data)
    assert movie.genres is None
    assert movie.spoken_languages is None
    assert movie.is_my_kind_of_movie() is False


def test_empty_strings_to_none():
    """Test that empty strings and list are converted to None."""
    data = {
        "id": 123,
        "title": "Test Movie",
        "status": "",
        "overview": "",
        "genres": "",
        "spoken_languages": [],
        "production_companies": [],
        "production_countries": [],
        "keywords": {},
        "tagline": "",
        "cast": "",
    }
    movie = MovieCreate(**data)
    assert movie.status is None
    assert movie.overview is None
    assert movie.genres is None
    assert movie.spoken_languages is None
    assert movie.production_companies is None
    assert movie.production_countries is None
    assert movie.keywords is None
    assert movie.tagline is None
    assert movie.cast is None
    assert not movie.is_my_kind_of_movie()


def test_empty_strings_and_none_fields():
    """Test that empty strings and None values are handled correctly."""
    data = {
        "id": 123,
        "title": "Test Movie",
        "status": "",
        "overview": "",
        "genres": "",
        "release_date": None,
        "popularity": None,
        "runtime": None,
        "vote_average": None,
        "vote_count": None,
        "spoken_languages": [],
        "production_companies": [],
        "production_countries": [],
        "keywords": {},
        "tagline": "",
        "cast": "",
    }

    movie = MovieCreate(**data)
    assert movie.status is None
    assert movie.overview is None
    assert movie.genres is None
    assert movie.spoken_languages is None
    assert movie.production_companies is None
    assert movie.production_countries is None
    assert movie.keywords is None
    assert movie.tagline is None
    assert movie.cast is None
    assert not movie.is_my_kind_of_movie()


def test_missing_required_fields():
    """Test that missing required fields (tmdb_id, title) raise ValidationError."""
    data = {"status": "Released", "genres": [{"name": "Drama"}], "spoken_languages": [{"english_name": "English"}]}
    with pytest.raises(ValidationError) as cm:
        MovieCreate(**data)
    errors = cm.value.errors()
    assert len(errors) == 2
    assert errors[0]["loc"] == ("tmdb_id",)
    assert errors[1]["loc"] == ("title",)


def test_invalid_types(example_response):
    """Test that invalid types raise ValidationError."""
    example_response.update(
        {
            "id": "not_an_int",
            "title": 123,
            "vote_average": "not_a_float",
            "release_date": "not_a_date",
            "popularity": "not_a_float",
            "runtime": "not_an_int",
            "vote_average": "not_a_float",
            "vote_count": "not_an_int",
        }
    )

    with pytest.raises(ValidationError) as e:
        MovieCreate(**example_response)
    errors = e.value.errors()
    assert len(errors) == 7


def test_is_my_kind_of_movie_english(example_response):
    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "French"}],
        "genres": [{"name": "Action"}, {"name": "Thriller"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()


def test_is_my_kind_of_movie_turkish(example_response):
    data = {
        "spoken_languages": [{"english_name": "Turkish"}, {"english_name": "French"}],
        "genres": [{"name": "Action"}, {"name": "Thriller"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()


def test_is_my_kind_of_movie_swedish(example_response):
    data = {
        "spoken_languages": [{"english_name": "Swedish"}, {"english_name": "German"}],
        "genres": [{"name": "Documentary"}, {"name": "Comedy"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is True


def test_is_my_kind_of_movie_documentary(example_response):
    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "German"}],
        "genres": [{"name": "Documentary"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_music(example_response):
    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "German"}],
        "genres": [{"name": "Music"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_documentary_music(example_response):
    data = {
        "spoken_languages": [{"english_name": "Swedish"}, {"english_name": "German"}],
        "genres": [{"name": "Documentary"}, {"name": "Music"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_no_language(example_response):
    data = {
        "spoken_languages": [{"english_name": "Mandarin"}, {"english_name": "German"}],
        "genres": [{"name": "Action"}, {"name": "Drama"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_mixed_case_language(example_response):
    data = {
        "spoken_languages": [{"english_name": "ENGLISH"}, {"english_name": "turkish"}, {"english_name": "SwEdIsh"}],
        "genres": [{"name": "Action"}, {"name": "Drama"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()

    data = {"spoken_languages": [{"english_name": "MaNdarin"}, {"english_name": "SwEdIsh"}]}
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()

    data = {"spoken_languages": [{"english_name": "MaNdarin"}]}
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_similar_genres(example_response):
    data = {
        "spoken_languages": [{"english_name": "ENGLISH"}, {"english_name": "turkish"}, {"english_name": "SwEdIsh"}],
        "genres": [{"name": "Musical"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()


def test_is_my_kind_of_movie_similar_genres_no_match_language(example_response):
    data = {
        "spoken_languages": [{"english_name": "Gobbligook"}, {"english_name": "Mandarin"}],
        "genres": [{"name": "Musical"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_empty_genres(example_response):
    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "Mandarin"}],
        "genres": [],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.genres is None
    assert not movie.is_my_kind_of_movie()


def test_is_my_kind_of_movie_mixed_case_genres(example_response):
    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "Mandarin"}],
        "genres": [{"name": "DOcUmentary"}, {"name": "MusIc"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False

    data = {
        "spoken_languages": [{"english_name": "English"}, {"english_name": "Mandarin"}],
        "genres": [{"name": "DrAma"}, {"name": "MusIc"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()

    data = {
        "spoken_languages": [{"english_name": "Urdu"}, {"english_name": "Mandarin"}],
        "genres": [{"name": "DrAma"}, {"name": "MusIc"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False


def test_is_my_kind_of_movie_multiple_genres_no_match(example_response):
    data = {
        "genres": [
            {"name": "Documentary"}, {"name": "MusIc"}, {"name": "Action"},
            {"name": "Thriller"}, {"name": "DrAma"}, {"name": "MusIcal"},
        ],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False

    data = {
        "genres": [
            {"name": "Documentary"}, {"name": "Action"},
            {"name": "Thriller"}, {"name": "DrAma"}, {"name": "MusIcal"},
        ],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie()


def test_is_my_kind_of_movie_no_language_valid_genre(example_response):
    data = {
        "spoken_languages": [],
        "genres": [{"name": "DrAma"}, {"name": "MusIcAl"}],
    }
    example_response.update(data)
    movie = MovieCreate(**example_response)
    assert movie.is_my_kind_of_movie() is False
