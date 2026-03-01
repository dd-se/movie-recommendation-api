from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError as JWTInvalidTokenError
from pydantic import ValidationError

from backend.core.logging import get_logger
from backend.domain.errors import (
    InvalidCredentialsError,
    InvalidTokenError,
    UserAlreadyExistsError,
    UserDisabledError,
)
from backend.infrastructure.db.models.user import User
from backend.infrastructure.db.repositories.user import UserRepository

logger = get_logger(__name__)


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def generate_access_token(
    data: dict[str, str],
    secret_key: str,
    algorithm: str = "HS256",
    expires_delta: timedelta | None = None,
) -> str:
    to_encode: dict[str, str | datetime] = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def authenticate_user(user_repo: UserRepository, email: str, password: str) -> User:
    user = user_repo.find_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise InvalidCredentialsError("Incorrect email or password")
    if user.disabled:
        raise UserDisabledError()
    return user


def create_user(user_repo: UserRepository, email: str, password: str) -> User:
    if user_repo.find_by_email(email):
        raise UserAlreadyExistsError("Email already registered")
    user = User(email=email, hashed_password=hash_password(password))
    return user_repo.add(user)


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256",
) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        return payload
    except (JWTInvalidTokenError, ValidationError) as e:
        logger.warning(f"JWT validation failed: {e}")
        raise InvalidTokenError("Could not validate credentials")
    except Exception as e:
        logger.error(f"Unexpected error: '{e}'", exc_info=True)
        raise InvalidTokenError("Could not validate credentials")
