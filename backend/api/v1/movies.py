from fastapi import APIRouter

from ...storage.db import ApiSession
from ...validation import MovieFilter, MovieSchema
from ..exceptions import NOT_FOUND

movie_router = APIRouter(tags=["movie"])


@movie_router.post("/movie", summary="Get a movie recommendation", response_model=list[MovieSchema])
async def get_recommendation(movie_filter: MovieFilter, db: ApiSession):
    movies = movie_filter.get_movie(db)
    if not movies:
        raise NOT_FOUND
    return movies
