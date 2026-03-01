from datetime import datetime, timezone


from sqlalchemy import Row, func, select, update
from sqlalchemy.orm import Session

from ..models.movie import Movie
from ..models.queue import MovieQueue, QueueStatus


class QueueRepository:
    def __init__(self, session: Session):
        self._session = session

    def find_by_status(
        self, status: QueueStatus, *, order_by_updated: bool = False, limit: int | None = None,
    ) -> list[MovieQueue]:
        q = select(MovieQueue).where(MovieQueue.status == status)
        if order_by_updated:
            q = q.order_by(MovieQueue.updated_at.asc())
        else:
            q = q.order_by(MovieQueue.created_at.asc())
        if limit:
            q = q.limit(limit)
        return self._session.execute(q).scalars().all()

    def find_movies_without_queue(self) -> list[Movie]:
        return self._session.execute(
            select(Movie)
            .outerjoin(MovieQueue, Movie.tmdb_id == MovieQueue.tmdb_id)
            .where(MovieQueue.tmdb_id.is_(None))
        ).scalars().all()

    def add(self, entity: MovieQueue) -> None:
        self._session.add(entity)

    def bulk_update_status(
        self,
        target_status: QueueStatus,
        message: str | None = None,
        movie_ids: list[int] | None = None,
    ) -> int:
        q = update(MovieQueue)
        if movie_ids:
            q = q.where(MovieQueue.tmdb_id.in_(movie_ids))
        q = q.values(status=target_status, message=message, retries=0, updated_at=datetime.now(timezone.utc))
        result = self._session.execute(q)
        return result.rowcount

    def list_with_titles(
        self, *, page: int = 1, per_page: int = 20, status: QueueStatus | None = None,
    ) -> tuple[list[Row[tuple[MovieQueue, str | None]]], int]:
        q = select(MovieQueue, Movie.title).outerjoin(Movie, MovieQueue.tmdb_id == Movie.tmdb_id)
        count_q = select(func.count(MovieQueue.id))
        if status:
            q = q.where(MovieQueue.status == status)
            count_q = count_q.where(MovieQueue.status == status)
        total = self._session.execute(count_q).scalar() or 0
        rows = self._session.execute(
            q.order_by(MovieQueue.updated_at.desc().nullslast(), MovieQueue.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).all()
        return rows, total

    def count_by_status(self) -> dict[str, int]:
        rows = self._session.execute(
            select(MovieQueue.status, func.count(MovieQueue.id)).group_by(MovieQueue.status)
        ).all()
        return {str(s): c for s, c in rows}
