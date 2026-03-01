import os

os.environ["TMDB_API_KEY"] = "test_api_key"
os.environ["USE_CUDA"] = "false"
os.environ["SECRET_KEY"] = "test_secret_key_for_testing_purposes_only_32_chars"
os.environ["ACCESS_TOKEN_EXPIRE_DAYS"] = "32"
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from requests import RequestException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import app
from backend.infrastructure.db.base import Base
from backend.api.deps import get_current_user, get_session
from backend.infrastructure.db.models import Movie, User

TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

with open(Path(__file__).parent / "external_api_example_response.json", encoding="utf-8") as f:
    MOVIE_RESPONSE: dict = json.load(f)
GENERIC_RESPONSE = {"results": [{"id": 550}, {"id": 551}, {"id": 552}]}


class MockResponseObject:
    def __init__(self, mock_data: dict | None = None):
        self.mock_data = mock_data or {}

    def json(self):
        return self.mock_data

    def raise_for_status(self):
        pass


def mock_requests_get(url: str, **kwargs):
    if any(endpoint in url for endpoint in ["now_playing", "top_rated", "popular"]):
        return MockResponseObject(GENERIC_RESPONSE)

    movie_id = url.split("/")[-1]
    if movie_id == "99999999":
        raise RequestException("Movie not found")

    return MockResponseObject(MOVIE_RESPONSE)


@pytest.fixture(scope="function")
def in_memory_test_db():
    Base.metadata.create_all(bind=test_engine)

    try:
        db = TestingSessionLocal()

        mov_1 = Movie(
            tmdb_id=550,
            title="Fight Club",
            status="Released",
            release_date=datetime(1999, 10, 15).date(),
            overview="A ticking-time-bomb insomniac...",
            popularity=65.123,
            runtime=139,
            vote_average=8.4,
            vote_count=25000,
            genres="Drama, Thriller",
            spoken_languages="English",
            cast="Brad Pitt, Edward Norton",
        )

        mov_2 = Movie(
            tmdb_id=551,
            title="Test Movie",
            status="Released",
            release_date=datetime(2025, 1, 1).date(),
            overview="Test overview",
            popularity=50.0,
            runtime=120,
            vote_average=7.5,
            vote_count=1000,
            genres="Action, Adventure",
            spoken_languages="English",
            cast="Actor One, Actor Two",
        )

        db.add_all([mov_1, mov_2])
        db.commit()

    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def mock_external_api_requests(monkeypatch):
    monkeypatch.setattr("backend.infrastructure.external.tmdb_client.requests.get", mock_requests_get)


@pytest.fixture(scope="function")
def mock_scheduler(monkeypatch):
    dummy_scheduler = Mock()
    monkeypatch.setattr("backend.infrastructure.scheduler.background_scheduler", dummy_scheduler)


async def override_get_current_user():
    test_user = User(id=1, email="test@example.com", hashed_password="none")
    test_user.access_token_expires = datetime.now(timezone.utc)
    test_user.access_token_scopes = ["movie:read"]
    return test_user


def override_get_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(in_memory_test_db, mock_external_api_requests, mock_scheduler):
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_session] = override_get_session
    client = TestClient(app)

    yield client

    app.dependency_overrides.clear()
    client.close()


@pytest.fixture(scope="function")
def example_response():
    yield MOVIE_RESPONSE.copy()
