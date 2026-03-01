from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from backend.domain.errors import (
    DomainError,
    InsufficientPermissionsError,
    InvalidCredentialsError,
    InvalidTokenError,
    NotFoundError,
    UserAlreadyExistsError,
    UserDisabledError,
)

_ERROR_MAP: dict[type[DomainError], tuple[int, str, dict[str, str] | None]] = {
    NotFoundError: (status.HTTP_404_NOT_FOUND, "Not found", None),
    UserAlreadyExistsError: (status.HTTP_400_BAD_REQUEST, "Email already registered", None),
    UserDisabledError: (
        status.HTTP_400_BAD_REQUEST,
        "User disabled! Contact Administrator at I@dont.care.",
        None,
    ),
    InvalidCredentialsError: (
        status.HTTP_401_UNAUTHORIZED,
        "Incorrect email or password",
        {"WWW-Authenticate": "Bearer"},
    ),
    InsufficientPermissionsError: (
        status.HTTP_401_UNAUTHORIZED,
        "Not enough permissions",
        {"WWW-Authenticate": "Bearer"},
    ),
    InvalidTokenError: (
        status.HTTP_401_UNAUTHORIZED,
        "Could not validate credentials",
        {"WWW-Authenticate": "Bearer"},
    ),
}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        for error_type, (status_code, detail, headers) in _ERROR_MAP.items():
            if isinstance(exc, error_type):
                return JSONResponse(
                    status_code=status_code,
                    content={"detail": detail},
                    headers=headers,
                )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
