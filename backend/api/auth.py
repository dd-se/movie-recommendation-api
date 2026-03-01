import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import jwt
from fastapi import APIRouter, Depends, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, SecurityScopes
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy import select

from ..logger import get_logger
from ..storage.db import ApiSession, User
from ..validation import ApiTokenSchema, UserCreate, UserSchema, ValidateTokenData
from .exceptions import DISABLED_USER, EXISTING_USER, INVALID_EMAIL_PASSWORD, INVALID_JWT_TOKEN, NOT_ENOUGH_PERMISSIONS

logger = get_logger(__name__)

auth_router = APIRouter(prefix="/auth", tags=["security"])

SECRET_KEY = os.environ["SECRET_KEY"]
ACCESS_TOKEN_EXPIRE_DAYS = int(os.environ["ACCESS_TOKEN_EXPIRE_DAYS"])
ALGORITHM = "HS256"


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
        logger.error(f"Unexpected error occured: '{e}'", exc_info=True)
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


@auth_router.post("/signup", summary="Create a new user for API access")
def create_user(user: UserCreate, db: ApiSession) -> UserSchema:
    existing_user = get_user(db, user.email)

    if existing_user:
        raise EXISTING_USER

    hashed_password = get_password_hash(user.password)
    user_in_db = User(email=user.email, hashed_password=hashed_password)
    db.add(user_in_db)
    db.commit()
    db.refresh(user_in_db)
    return user_in_db


@auth_router.post("/login", summary="Login to get an API key to access protected endpoints")
def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: ApiSession) -> ApiTokenSchema:
    user = authenticate_user(db, form_data.username, form_data.password)
    access_token_expires = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)

    user_scopes = user.get_scopes()
    if any(scope not in user_scopes for scope in form_data.scopes):
        raise NOT_ENOUGH_PERMISSIONS

    access_token = generate_access_token(
        data={"sub": user.email, "scope": " ".join(form_data.scopes)},
        expires_delta=access_token_expires,
    )
    return ApiTokenSchema(access_token=access_token, token_type="bearer")


@auth_router.get("/whoami", summary="Get details about the current user")
def whoami(user: AuthedUser_MR) -> UserSchema:
    return user


@auth_router.get("/write-test", summary="Test write access to protected endpoints")
def write_test(user: AuthedUser_MW) -> UserSchema:
    return user
