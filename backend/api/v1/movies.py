from fastapi import APIRouter

from ...storage.db import ApiSession
from ...validation import MovieFilter, MovieSchema
from ..exceptions import NOT_FOUND

movie_router = APIRouter(tags=["movie"])


@movie_router.post("/movie", summary="Get a movie recommendation")
def get_recommendation(movie_filter: MovieFilter, db: ApiSession) -> list[MovieSchema]:
    movies = movie_filter.get_movie(db)
    if not movies:
        raise NOT_FOUND
    return movies
