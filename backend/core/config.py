import os

from dotenv import load_dotenv

load_dotenv()

SECRET_KEY: str = os.environ["SECRET_KEY"]
ACCESS_TOKEN_EXPIRE_DAYS: int = int(os.environ["ACCESS_TOKEN_EXPIRE_DAYS"])
ALGORITHM: str = "HS256"
CORS_ORIGINS: list[str] = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
