from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints


class ApiTokenSchema(BaseModel):
    access_token: str
    token_type: str


class UserBase(BaseModel):
    email: EmailStr


class ValidateTokenData(UserBase):
    scopes: list[str]
    access_token_expires: datetime


class UserCreate(UserBase):
    password: Annotated[str, StringConstraints(min_length=2, max_length=15, strip_whitespace=True)]


class UserSchema(UserBase):
    model_config = ConfigDict(from_attributes=True)

    access_token_scopes: list[str] | None = None
    access_token_expires: datetime | None = None
