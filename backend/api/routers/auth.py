from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from backend.application.auth_service import (
    authenticate_user,
    create_user,
    generate_access_token,
)
from backend.core.settings import Settings, get_settings
from backend.domain.errors import InsufficientPermissionsError
from backend.api.deps import AuthedUser_MR, AuthedUser_MW, DbSession, UserRepoDep
from backend.api.schemas.auth import ApiTokenSchema, UserCreate, UserSchema

router = APIRouter(prefix="/auth", tags=["security"])


@router.post("/signup", summary="Create a new user")
def signup(user: UserCreate, user_repo: UserRepoDep, session: DbSession) -> UserSchema:
    new_user = create_user(user_repo, user.email, user.password)
    session.commit()
    session.refresh(new_user)
    return new_user


@router.post("/login", summary="Login for an access token")
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    user_repo: UserRepoDep,
    settings: Settings = Depends(get_settings),
) -> ApiTokenSchema:
    user = authenticate_user(user_repo, form_data.username, form_data.password)
    user_scopes = user.get_scopes()
    if any(scope not in user_scopes for scope in form_data.scopes):
        raise InsufficientPermissionsError("Not enough permissions")
    access_token = generate_access_token(
        data={"sub": user.email, "scope": " ".join(form_data.scopes)},
        secret_key=settings.security.secret_key,
        algorithm=settings.security.jwt_algorithm,
        expires_delta=timedelta(days=settings.security.access_token_expire_days),
    )
    return ApiTokenSchema(access_token=access_token, token_type="bearer")


@router.get("/whoami", summary="Get current user details")
def whoami(user: AuthedUser_MR) -> UserSchema:
    return user


@router.get("/write-test", summary="Test write access")
def write_test(user: AuthedUser_MW) -> UserSchema:
    return user
