from fastapi import HTTPException, status

NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
EXISTING_USER = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="Email already registered",
)
DISABLED_USER = HTTPException(
    status_code=status.HTTP_400_BAD_REQUEST,
    detail="User disabled! Contact Administrator at I@dont.care.",
)
INVALID_EMAIL_PASSWORD = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Incorrect email or password",
    headers={"WWW-Authenticate": "Bearer"},
)
NOT_ENOUGH_PERMISSIONS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not enough permissions",
    headers={"WWW-Authenticate": "Bearer"},
)
INVALID_JWT_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)
