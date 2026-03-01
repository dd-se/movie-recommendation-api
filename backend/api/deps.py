from collections.abc import Generator
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, Request, Security
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy.orm import Session

from backend.application.auth_service import decode_access_token
from backend.application.movie_service import MovieQueryService
from backend.core.logging import get_logger
from backend.core.settings import Settings, get_settings
from backend.domain.errors import (
    InsufficientPermissionsError,
    InvalidTokenError,
    UserDisabledError,
)
from backend.infrastructure.db.models.user import User
from backend.infrastructure.db.repositories.movie import MovieRepository
from backend.infrastructure.db.repositories.queue import QueueRepository
from backend.infrastructure.db.repositories.recommendation import RecommendationRepository
from backend.infrastructure.db.repositories.user import UserRepository

logger = get_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    scopes={
        "movie:read": "Can use read endpoints",
        "movie:write": "Can use write endpoints",
    },
)


def get_session(request: Request) -> Generator[Session, None, None]:
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


DbSession = Annotated[Session, Depends(get_session)]


def get_movie_repo(session: DbSession) -> MovieRepository:
    return MovieRepository(session)


def get_user_repo(session: DbSession) -> UserRepository:
    return UserRepository(session)


def get_queue_repo(session: DbSession) -> QueueRepository:
    return QueueRepository(session)


def get_recommendation_repo(session: DbSession) -> RecommendationRepository:
    return RecommendationRepository(session)


def get_movie_service(
    movie_repo: Annotated[MovieRepository, Depends(get_movie_repo)],
    request: Request,
) -> MovieQueryService:
    vector_store = getattr(request.app.state, "vector_store", None)
    return MovieQueryService(movie_repo, vector_store)


MovieRepoDep = Annotated[MovieRepository, Depends(get_movie_repo)]
UserRepoDep = Annotated[UserRepository, Depends(get_user_repo)]
QueueRepoDep = Annotated[QueueRepository, Depends(get_queue_repo)]
RecommendationRepoDep = Annotated[RecommendationRepository, Depends(get_recommendation_repo)]
MovieServiceDep = Annotated[MovieQueryService, Depends(get_movie_service)]


from backend.api.schemas.auth import ValidateTokenData


def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
    session: DbSession,
    settings: Settings = Depends(get_settings),
) -> User:
    payload = decode_access_token(
        token, settings.security.secret_key, settings.security.jwt_algorithm
    )
    scope: str = payload.get("scope", "")
    try:
        token_data = ValidateTokenData(
            email=payload.get("sub"),
            scopes=scope.split(" "),
            access_token_expires=datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc),
        )
    except Exception as e:
        logger.warning(f"Token data validation failed: {e}")
        raise InvalidTokenError("Could not validate credentials")

    user_repo = UserRepository(session)
    user = user_repo.find_by_email(email=token_data.email)
    if user is None:
        raise InvalidTokenError("Could not validate credentials")

    user_scopes = user.get_scopes()
    for scope in security_scopes.scopes:
        if scope not in token_data.scopes or scope not in user_scopes:
            raise InsufficientPermissionsError("Not enough permissions")

    user.access_token_scopes = token_data.scopes
    user.access_token_expires = token_data.access_token_expires
    return user


def get_current_active_user(
    current_user: Annotated[User, Security(get_current_user)],
) -> User:
    if current_user.disabled:
        raise UserDisabledError()
    return current_user


AuthedUser_MR = Annotated[User, Security(get_current_active_user, scopes=["movie:read"])]
AuthedUser_MW = Annotated[User, Security(get_current_active_user, scopes=["movie:write"])]
