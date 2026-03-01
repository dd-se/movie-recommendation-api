from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, Integer, String, Text, event, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from ..core.logging import get_logger

logger = get_logger(__name__)

SELECTED_MOVIE_COLUMNS = [
    "title", "status", "release_date", "poster_path", "runtime",
    "vote_average", "vote_count", "popularity", "overview", "tagline",
    "genres", "spoken_languages", "production_companies",
    "production_countries", "keywords", "cast",
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

    def update(self, validated_movie: "MovieCreate") -> bool:
        changed = False
        for col in SELECTED_MOVIE_COLUMNS:
            old_value = getattr(self, col)
            new_value = getattr(validated_movie, col)
            if new_value and old_value != new_value:
                setattr(self, col, new_value)
                if not changed:
                    changed = True
                logger.warning(f"Updated movie tmdb_id '{self.tmdb_id}' field '{col}' from '{old_value}' to '{new_value}'")
        return changed

    def get_description_metadata(self) -> str:
        return " ".join(
            map(str.lower, (
                self.overview or "", self.tagline or "", self.keywords or "",
                self.genres or "", self.production_companies or "",
                self.production_countries or "", self.spoken_languages or "",
            ))
        )

    def get_description(self) -> str:
        fields = {
            "Overview": self.overview.rstrip(".?!") if self.overview else None,
            "Tagline": self.tagline.rstrip(".?!") if self.tagline else None,
            "Keywords": self.keywords,
            "Genres": self.genres,
            "Production Companies": self.production_companies,
            "Production Countries": self.production_countries,
            "Spoken Languages": self.spoken_languages,
        }
        return ". ".join(f"{label}: {value}" for label, value in fields.items() if value)

    def get_metadata(self) -> dict:
        metadata: dict = {
            "tmdb_id": self.tmdb_id, "title": self.title,
            "runtime": self.runtime, "vote_average": self.vote_average,
            "vote_count": self.vote_count, "popularity": self.popularity,
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

    def __repr__(self) -> str:
        return f"<Movie(id={self.tmdb_id}, title={self.title!r})>"


@event.listens_for(Movie, "before_update")
def movie_trigger(mapper, connection, movie: Movie) -> None:
    movie.updated_at = datetime.now(timezone.utc)
