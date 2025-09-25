from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select

from ...storage.db import ApiSession, Movie, MovieQueue, MovieRecommendation, QueueStatus
from ..auth import AuthedUser_MR, AuthedUser_MW
from ..exceptions import NOT_FOUND

user_router = APIRouter(prefix="/user", tags=["user"])


@user_router.post("/forget-recommends", summary="Forget movie recommendations")
async def forget_user_recommendations(user: AuthedUser_MR, db: ApiSession):
    """Deletes all movie recommendations associated with the user."""
    del_stmt = delete(MovieRecommendation).where(MovieRecommendation.user_id == user.id)
    result = db.execute(del_stmt)
    if result.rowcount == 0:
        raise NOT_FOUND
    db.commit()
    return {"detail": "User recommendations have been deleted."}
