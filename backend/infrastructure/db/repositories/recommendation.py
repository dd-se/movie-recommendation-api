from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..models.user import MovieRecommendation


class RecommendationRepository:
    def __init__(self, session: Session):
        self._session = session

    def add_all(self, recommendations: list[MovieRecommendation]) -> None:
        self._session.add_all(recommendations)

    def delete_for_user(self, user_id: int) -> int:
        result = self._session.execute(
            delete(MovieRecommendation).where(MovieRecommendation.user_id == user_id)
        )
        return result.rowcount
