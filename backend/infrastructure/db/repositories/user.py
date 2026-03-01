from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models.user import User


class UserRepository:
    def __init__(self, session: Session):
        self._session = session

    def find_by_email(self, email: str) -> User | None:
        return self._session.execute(
            select(User).where(User.email == email)
        ).scalar()

    def find_by_id(self, user_id: int) -> User | None:
        return self._session.execute(
            select(User).where(User.id == user_id)
        ).scalar()

    def add(self, user: User) -> User:
        self._session.add(user)
        self._session.flush()
        self._session.refresh(user)
        return user

    def list_paginated(
        self, *, page: int = 1, per_page: int = 20, search: str = "",
    ) -> tuple[list[User], int]:
        q = select(User)
        count_q = select(func.count(User.id))
        if search:
            q = q.where(User.email.icontains(search))
            count_q = count_q.where(User.email.icontains(search))
        total = self._session.execute(count_q).scalar() or 0
        users = self._session.execute(
            q.order_by(User.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars().all()
        return users, total

    def count(self) -> int:
        return self._session.execute(select(func.count(User.id))).scalar() or 0

    def count_active(self) -> int:
        return self._session.execute(
            select(func.count(User.id)).where(User.disabled == False)
        ).scalar() or 0
