from fastapi import APIRouter
from sqlalchemy import delete

from ...storage.db import ApiSession, MovieRecommendation
from ...validation import DetailResponse
from ..auth import AuthedUser_MR
from ..exceptions import NOT_FOUND

user_router = APIRouter(prefix="/user", tags=["user"])


@user_router.post("/forget-recommends", summary="Forget movie recommendations")
def forget_user_recommendations(user: AuthedUser_MR, db: ApiSession) -> DetailResponse:
    """Deletes all movie recommendations associated with the user."""
    del_stmt = delete(MovieRecommendation).where(MovieRecommendation.user_id == user.id)
    result = db.execute(del_stmt)
    if result.rowcount == 0:
        raise NOT_FOUND
    db.commit()
    return DetailResponse(detail="User recommendations have been deleted.")
