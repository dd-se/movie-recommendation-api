from collections.abc import Generator
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DB_PATH = Path(__file__).parent.parent.parent / "data" / "db"
DB_PATH.mkdir(parents=True, exist_ok=True)
FILE = DB_PATH / "movies.db"

SQLALCHEMY_DATABASE_URL = f"sqlite:///{FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db_gen() -> Generator[Session, Any, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_db() -> Session:
    return SessionLocal()


ApiSession = Annotated[Session, Depends(get_db_gen)]
