from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select

from ..storage.db import ApiSession, Movie, MovieQueue, MovieRecommendation, QueueStatus
from .auth import AuthedUser_MR, AuthedUser_MW
from .exceptions import NOT_FOUND

admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/sync", summary="Sync Movie and MovieQueue tables", status_code=status.HTTP_200_OK)
async def sync_movie_and_movie_queue_tables(admin: AuthedUser_MW, db: ApiSession):
    """Ensures that for every movie in the Movie table, there is a corresponding entry in the MovieQueue table."""
    movies = (
        db.execute(
            select(Movie).outerjoin(MovieQueue, Movie.tmdb_id == MovieQueue.tmdb_id).where(MovieQueue.tmdb_id == None)
        )
        .scalars()
        .all()
    )
    if not movies:
        raise NOT_FOUND

    recreated_count = 0
    for movie in movies:
        new_queue_entry = MovieQueue(tmdb_id=movie.tmdb_id)
        db.add(new_queue_entry)
        recreated_count += 1

    db.commit()
    return {"detail": f"Recreated '{recreated_count}' missing MovieQueue entries."}
