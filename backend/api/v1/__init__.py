from fastapi import APIRouter

from .movies import movie_router

v1_router = APIRouter(prefix="/v1", tags=["v1"])
v1_router.include_router(movie_router)
