from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base
from .movie import Movie


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

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email!r})>"

    def __init__(self, **kwargs) -> None:
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

    def __repr__(self) -> str:
        return f"<Rec(user_id={self.user_id}, movie_tmdb_id={self.tmdb_id})>"
