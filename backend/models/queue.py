from datetime import datetime, timezone
from enum import Enum as PythonEnum

from sqlalchemy import DateTime, ForeignKey, Integer, Text, event, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class QueueStatus(PythonEnum):
    REFRESH_DATA = "refresh_data"
    PREPROCESS_DESCRIPTION = "preprocess_description"
    CREATE_EMBEDDING = "create_embedding"
    COMPLETED = "completed"
    FAILED = "failed"

    def __str__(self) -> str:
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

    def __repr__(self) -> str:
        return f"<DescQueue(status={self.status!r}, movie_tmdb_id={self.tmdb_id})>"


@event.listens_for(MovieQueue, "before_update")
def desc_trigger(mapper, connection, movie_queue: MovieQueue) -> None:
    movie_queue.updated_at = datetime.now(timezone.utc)
