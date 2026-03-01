from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from ..core.config import ACCESS_TOKEN_EXPIRE_DAYS
from ..core.database import ApiSession
from ..core.exceptions import EXISTING_USER, NOT_ENOUGH_PERMISSIONS
from ..core.security import (
    AuthedUser_MR,
    AuthedUser_MW,
    authenticate_user,
    generate_access_token,
    get_password_hash,
    get_user,
)
from ..models.user import User
from ..schemas.auth import ApiTokenSchema, UserCreate, UserSchema

router = APIRouter(prefix="/auth", tags=["security"])


@router.post("/signup", summary="Create a new user")
def create_user(user: UserCreate, db: ApiSession) -> UserSchema:
    if get_user(db, user.email):
        raise EXISTING_USER
    user_in_db = User(email=user.email, hashed_password=get_password_hash(user.password))
    db.add(user_in_db)
    db.commit()
    db.refresh(user_in_db)
    return user_in_db


@router.post("/login", summary="Login for an access token")
def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: ApiSession) -> ApiTokenSchema:
    user = authenticate_user(db, form_data.username, form_data.password)
    user_scopes = user.get_scopes()
    if any(scope not in user_scopes for scope in form_data.scopes):
        raise NOT_ENOUGH_PERMISSIONS
    access_token = generate_access_token(
        data={"sub": user.email, "scope": " ".join(form_data.scopes)},
        expires_delta=timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    )
    return ApiTokenSchema(access_token=access_token, token_type="bearer")


@router.get("/whoami", summary="Get current user details")
def whoami(user: AuthedUser_MR) -> UserSchema:
    return user


@router.get("/write-test", summary="Test write access")
def write_test(user: AuthedUser_MW) -> UserSchema:
    return user
