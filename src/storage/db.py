import sqlite3
from collections.abc import Generator
from datetime import date, datetime, timezone
from enum import Enum as PythonEnum
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Select,
    String,
    Text,
    UniqueConstraint,
    Update,
    create_engine,
    event,
    func,
    update,
)
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, Session, declarative_base, mapped_column, relationship, sessionmaker

from ..logger import get_logger

logger = get_logger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "db"
BACKUP_PATH = DB_PATH / "backups"
BACKUP_PATH.mkdir(parents=True, exist_ok=True)

FILE = DB_PATH / "movies.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    scopes: Mapped[str] = mapped_column(String, default="movie:read")

    recommendations: Mapped[list["MovieRecommendation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email!r})>"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.access_token_scopes: list[str] | None = None
        self.access_token_expires: datetime | None = None

    def get_scopes(self) -> list[str]:
        return self.scopes.split(" ")


class MovieRecommendation(Base):
    __tablename__ = "movie_recommendations"
    __table_args__ = (UniqueConstraint("user_id", "tmdb_id", name="unique_user_movie_recommendation"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tmdb_id: Mapped[int] = mapped_column(ForeignKey("movies.tmdb_id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    user_score: Mapped[int | None] = mapped_column(Integer)

    user: Mapped["User"] = relationship(back_populates="recommendations")
    movie: Mapped["Movie"] = relationship(back_populates="recommendations")

    def __repr__(self):
        return f"<Rec(user_id={self.user_id}, movie_tmdb_id={self.tmdb_id})>"


class QueueStatus(PythonEnum):
    REFRESH_DATA = "refresh_data"
    PREPROCESS_DESCRIPTION = "preprocess_description"
    CREATE_EMBEDDING = "create_embedding"
    COMPLETED = "completed"
    FAILED = "failed"

    def __str__(self):
        return self.value


class MovieQueue(Base):
    __tablename__ = "movie_queues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, ForeignKey("movies.tmdb_id"), unique=True, index=True)
    status: Mapped[QueueStatus] = mapped_column(
        SqlEnum(QueueStatus, native_enum=False),
        default=QueueStatus.PREPROCESS_DESCRIPTION,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    retries: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str | None] = mapped_column(Text)

    preprocessed_description: Mapped[str | None] = mapped_column(Text)

    movie: Mapped["Movie"] = relationship(back_populates="movie_queue")

    def __repr__(self):
        return f"<DescQueue(status={self.status!r}, movie_tmdb_id={self.tmdb_id})>"


SELECTED_MOVIE_COLUMNS = [
    "title",
    "status",
    "release_date",
    "poster_path",
    "runtime",
    "vote_average",
    "vote_count",
    "popularity",
    "overview",
    "tagline",
    "genres",
    "spoken_languages",
    "production_companies",
    "production_countries",
    "keywords",
    "cast",
]


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(primary_key=True)
    tmdb_id: Mapped[int] = mapped_column(Integer, unique=True, index=True)

    title: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str | None] = mapped_column(String)
    release_date: Mapped[date | None] = mapped_column(Date, index=True)
    poster_path: Mapped[str | None] = mapped_column(String)

    runtime: Mapped[int | None] = mapped_column(Integer, index=True)
    vote_average: Mapped[float | None] = mapped_column(Float, index=True)
    vote_count: Mapped[int | None] = mapped_column(Integer, index=True)
    popularity: Mapped[float | None] = mapped_column(Float, index=True)

    overview: Mapped[str | None] = mapped_column(Text)
    tagline: Mapped[str | None] = mapped_column(Text)

    genres: Mapped[str | None] = mapped_column(String, index=True)
    spoken_languages: Mapped[str | None] = mapped_column(String, index=True)
    production_companies: Mapped[str | None] = mapped_column(String)
    production_countries: Mapped[str | None] = mapped_column(String, index=True)
    keywords: Mapped[str | None] = mapped_column(String, index=True)
    cast: Mapped[str | None] = mapped_column(String)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    recommendations: Mapped[list["MovieRecommendation"]] = relationship(
        back_populates="movie", cascade="all, delete-orphan", lazy="selectin"
    )
    movie_queue: Mapped["MovieQueue"] = relationship(back_populates="movie", cascade="all, delete-orphan")

    def update(self, validated_movie) -> bool:
        should_preprocess_description_again = False

        for col in SELECTED_MOVIE_COLUMNS:
            old_value = getattr(self, col)
            new_value = getattr(validated_movie, col)

            if new_value and old_value != new_value:
                setattr(self, col, new_value)

                if should_preprocess_description_again is False:
                    should_preprocess_description_again = True

                logger.warning(f"Updated movie tmdb_id '{self.tmdb_id}' field '{col}' from '{old_value}' to '{new_value}'")

        return should_preprocess_description_again

    def get_description_metadata(self) -> str:
        description = " ".join(
            map(
                str.lower,
                (
                    self.overview or "",
                    self.tagline or "",
                    self.keywords or "",
                    self.genres or "",
                    self.production_companies or "",
                    self.production_countries or "",
                    self.spoken_languages or "",
                ),
            )
        )
        return description

    def get_description(self) -> str:
        parts = []
        fields = {
            "Overview": self.overview.rstrip(".?!") if self.overview else None,
            "Tagline": self.tagline.rstrip(".?!") if self.tagline else None,
            "Keywords": self.keywords,
            "Genres": self.genres,
            "Production Companies": self.production_companies,
            "Production Countries": self.production_countries,
            "Spoken Languages": self.spoken_languages,
        }

        for label, value in fields.items():
            if value:
                parts.append(f"{label}: {value}")

        return ". ".join(parts)

    def get_metadata(self) -> dict:
        metadata = {
            "tmdb_id": self.tmdb_id,
            "title": self.title,
            "runtime": self.runtime,
            "vote_average": self.vote_average,
            "vote_count": self.vote_count,
            "popularity": self.popularity,
            "status": self.status,
        }
        if self.overview:
            metadata["overview"] = self.overview
        if self.release_date:
            metadata["release_date"] = int(self.release_date.strftime("%Y%m%d"))
        if self.genres:
            metadata["genres"] = self.genres
        if self.poster_path:
            metadata["poster_path"] = self.poster_path
        if self.cast:
            metadata["cast"] = self.cast

        return metadata

    def __repr__(self):
        return f"<Movie(id={self.tmdb_id}, title={self.title!r})>"


@event.listens_for(Movie, "before_update")
def movie_trigger(mapper, connection, movie: Movie):
    movie.updated_at = datetime.now(timezone.utc)


@event.listens_for(MovieQueue, "before_update")
def desc_trigger(mapper, connection, movie_queue: MovieQueue):
    movie_queue.updated_at = datetime.now(timezone.utc)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db_gen() -> Generator[Session, Any, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


ApiSession = Annotated[Session, Depends(get_db_gen)]


def get_db() -> Session:
    return SessionLocal()


def backup_db() -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"movies_backup_{timestamp}.db"
    destination_path = BACKUP_PATH / backup_filename

    source_connection = sqlite3.connect(FILE)
    destination_connection = sqlite3.connect(destination_path)

    try:
        source_connection.backup(destination_connection)
        logger.warning(f"Backup of database created at: '{destination_path}'")
    finally:
        source_connection.close()
        destination_connection.close()


def execute_statement(query: Update):
    try:
        db = get_db()
        logger.warning(f"Executing SQL: {query.compile(compile_kwargs={'literal_binds': True})}")
        if input("Are you sure? Yes/No: ").lower() == "yes":
            updated = db.execute(query)

            if updated.rowcount == 0:
                logger.warning("No rows were updated")
            else:
                db.commit()
                logger.warning("Update statement executed successfully")

        else:
            logger.warning("Action aborted")

    except Exception as e:
        logger.error(f"Failed to execute update statement: '{e}'", exc_info=True)
        db.rollback()

    finally:
        db.close()


def update_queue_status(tmdb_ids: list[int] | None, new_status: QueueStatus, message: str | None) -> list[Any]:
    query: Update = update(MovieQueue).values(status=new_status, updated_at=func.now())

    if message:
        query = query.values(message=message)
    if tmdb_ids:
        query = query.where(MovieQueue.tmdb_id.in_(tmdb_ids))

    execute_statement(query)


def update_user(action: str, email: str, args: Any) -> None:
    query = update(User).where(User.email == email)

    if action == "status":
        query: Update = query.values(disabled=args)
    elif action == "scopes":
        query: Update = query.values(scopes=" ".join(args))
    else:
        raise ValueError("Something went wrong!")

    execute_statement(query)
