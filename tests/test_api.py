import pytest
from fastapi.testclient import TestClient

from src.validation import MovieFilter, MovieSearch, UserCreate


# API endpoint tests
def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200


def test_v1_endpoints(client: TestClient):
    """Test v1 movie recommendations without authentication."""
    movie_filter = MovieFilter(genres=["Drama", "Thriller"])
    response = client.post("/v1/movie", json=movie_filter.model_dump())
    assert response.status_code == 200
    movies = response.json()
    assert isinstance(movies, list)
    assert len(movies) > 0
    assert all("title" in movie for movie in movies)

    # Test with non-existent genre
    response = client.post("/v1/movie", json={"genres": ["NonExistentGenre"]})
    assert response.status_code == 404


def test_v2_endpoints(client: TestClient):
    movie_filter = MovieFilter(genres=["Drama", "Thriller"])
    response = client.post("/v2/movie", json=movie_filter.model_dump())
    assert response.status_code == 200

    # Test search endpoint
    search = MovieSearch(title="Fight Club", n_results=1)
    response = client.post("/v2/search", json=search.model_dump())
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["title"] == "Fight Club"

    # Should raise validation error
    response = client.post("/v2/search", json={"search_text": "Fight Club", "n_results": 1})
    assert response.status_code == 422


def test_auth_endpoints(client: TestClient):
    # Get user created for each test
    response = client.get("/auth/whoami")

    user = response.json()
    assert user["email"] == "test@example.com"
    assert "access_token_expires" in user
    assert response.status_code == 200

    # Test signup with new user
    user = UserCreate(email="newuser@example.com", password="pass")
    user_dict = user.model_dump()
    response = client.post("/auth/signup", json=user_dict)
    assert response.status_code == 200
    user = response.json()
    assert user["email"] == user_dict["email"]

    # Test signup with existing user should fail
    response = client.post("/auth/signup", json=user_dict)
    assert response.status_code == 409 or response.status_code == 400

    # Test with correct credentials
    form_data = {"username": user_dict["email"], "password": user_dict["password"], "scopes": "movie:read"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 200
    api_key_data = response.json()
    assert "access_token" in api_key_data
    assert api_key_data["token_type"] == "bearer"

    # Test with wrong password
    wrong_form_data = {"username": user_dict["email"], "password": "wrongpassword", "scopes": "movie:read"}
    response = client.post("/auth/login", data=wrong_form_data)
    assert response.status_code == 401

    # Test with non-existent user
    response = client.post("/auth/login", data={"username": "nouser@example.com", "password": "pass"})
    assert response.status_code == 401

    response = client.get("/auth/write-test", headers={"Authorization": "Bearer key"})
    assert response.status_code == 200
