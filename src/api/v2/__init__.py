from fastapi import APIRouter

from .movies import movie_router
from .user import user_router

v2_router = APIRouter(prefix="/v2", tags=["v2"])
v2_router.include_router(movie_router)
v2_router.include_router(user_router)
