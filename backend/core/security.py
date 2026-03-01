from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, Security
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy import select

from .config import ALGORITHM, SECRET_KEY
from .database import ApiSession
from .exceptions import DISABLED_USER, INVALID_JWT_TOKEN, NOT_ENOUGH_PERMISSIONS
from .logging import get_logger
from ..models.user import User
from ..schemas.auth import ValidateTokenData

logger = get_logger(__name__)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    scopes={
        "movie:read": "Can use read endpoints",
        "movie:write": "Can use write endpoints",
    },
)


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_user(db: ApiSession, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar()


def generate_access_token(data: dict[str, str], expires_delta: timedelta | None = None) -> str:
    to_encode: dict[str, str | datetime] = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: ApiSession, email: str, password: str) -> User:
    from .exceptions import INVALID_EMAIL_PASSWORD

    user = get_user(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise INVALID_EMAIL_PASSWORD
    if user.disabled:
        raise DISABLED_USER
    return user


def get_current_user(
    security_scopes: SecurityScopes,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: ApiSession,
) -> User:
    try:
        payload: dict = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        scope: str = payload.get("scope", "")
        token_data = ValidateTokenData(
            email=payload.get("sub"),
            scopes=scope.split(" "),
            access_token_expires=datetime.fromtimestamp(payload.get("exp"), tz=timezone.utc),
        )
    except (InvalidTokenError, ValidationError) as e:
        logger.warning(f"JWT validation failed: {e}")
        raise INVALID_JWT_TOKEN
    except Exception as e:
        logger.error(f"Unexpected error: '{e}'", exc_info=True)
        raise INVALID_JWT_TOKEN

    user = get_user(db, email=token_data.email)
    if user is None:
        raise INVALID_JWT_TOKEN

    user_scopes = user.get_scopes()
    for scope in security_scopes.scopes:
        if scope not in token_data.scopes or scope not in user_scopes:
            raise NOT_ENOUGH_PERMISSIONS

    user.access_token_scopes = token_data.scopes
    user.access_token_expires = token_data.access_token_expires
    return user


def get_current_active_user(current_user: Annotated[User, Security(get_current_user)]) -> User:
    if current_user.disabled:
        raise DISABLED_USER
    return current_user


AuthedUser_MR = Annotated[User, Security(get_current_active_user, scopes=["movie:read"])]
AuthedUser_MW = Annotated[User, Security(get_current_active_user, scopes=["movie:write"])]
