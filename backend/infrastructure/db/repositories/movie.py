from datetime import date
from typing import Any

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from ..base import Base
from ..models.movie import Movie


class MovieRepository:
    def __init__(self, session: Session):
        self._session = session

    @property
    def session(self) -> Session:
        return self._session

    def find_by_tmdb_id(self, tmdb_id: int) -> Movie | None:
        return self._session.execute(
            select(Movie).where(Movie.tmdb_id == tmdb_id)
        ).scalar()

    def find_tmdb_ids_in_db(self, tmdb_ids: set[int]) -> list[int]:
        return self._session.execute(
            select(Movie.tmdb_id).where(Movie.tmdb_id.in_(tmdb_ids))
        ).scalars().all()

    def find_tmdb_ids_by_filters(
        self, title: str | None = None, cast: list[str] | None = None,
    ) -> list[int]:
        q = select(Movie.tmdb_id)
        if title:
            q = q.where(Movie.title.icontains(title))
        if cast:
            q = self._apply_list_filter(q, Movie.cast, cast)
        return self._session.execute(q).scalars().all()

    def search(
        self,
        *,
        exclude_tmdb_ids: list[int] | None = None,
        title: str | None = None,
        release_date_from: date | None = None,
        release_date_to: date | None = None,
        runtime_min: int = 70,
        runtime_max: int | None = None,
        vote_average_min: float = 6.4,
        vote_count_min: int = 50,
        popularity_min: float | None = None,
        genres: list[str] | None = None,
        production_countries: list[str] | None = None,
        keywords: list[str] | None = None,
        spoken_languages: list[str] | None = None,
        cast: list[str] | None = None,
        limit: int = 1,
    ) -> list[Movie]:
        q = (
            select(Movie)
            .where(Movie.vote_count > vote_count_min)
            .order_by(
                ((Movie.vote_average * Movie.vote_count) / (Movie.vote_count + 100)).desc(),
                Movie.vote_count.desc(),
                Movie.popularity.desc(),
            )
            .limit(limit)
        )
        if exclude_tmdb_ids:
            q = q.where(Movie.tmdb_id.not_in(exclude_tmdb_ids))
        if title:
            q = q.where(Movie.title.icontains(title))
        if release_date_from:
            q = q.where(Movie.release_date >= release_date_from)
        if release_date_to:
            q = q.where(Movie.release_date <= release_date_to)
        q = q.where(Movie.runtime >= runtime_min)
        if runtime_max:
            q = q.where(Movie.runtime <= runtime_max)
        q = q.where(Movie.vote_average >= vote_average_min)
        if popularity_min:
            q = q.where(Movie.popularity >= popularity_min)
        for attr, vals in [
            (Movie.genres, genres),
            (Movie.production_countries, production_countries),
            (Movie.keywords, keywords),
            (Movie.spoken_languages, spoken_languages),
            (Movie.cast, cast),
        ]:
            if vals:
                q = self._apply_list_filter(q, attr, vals)
        return self._session.execute(q).scalars().all()

    def add(self, entity: Base) -> None:
        self._session.add(entity)

    def add_all(self, entities: list[Any]) -> None:
        self._session.add_all(entities)

    def count(self) -> int:
        return self._session.execute(select(func.count(Movie.id))).scalar() or 0

    @staticmethod
    def _apply_list_filter(
        query: Select[tuple[Movie]], attribute: InstrumentedAttribute, values: list[str],  # type: ignore[type-arg]
    ) -> Select[tuple[Movie]]:
        conditions = []
        for v in values:
            if v.startswith("!"):
                conditions.append(~attribute.icontains(v[1:]))
            else:
                conditions.append(attribute.icontains(v))
        return query.where(and_(*conditions))
