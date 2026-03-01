from fastapi import APIRouter

from ..core.database import ApiSession
from ..core.exceptions import NOT_FOUND
from ..schemas.movie import MovieFilter, MovieSchema

router = APIRouter(prefix="/v1", tags=["v1"])


@router.post("/movie", summary="Get a movie recommendation")
def get_recommendation(movie_filter: MovieFilter, db: ApiSession) -> list[MovieSchema]:
    movies = movie_filter.get_movie(db)
    if not movies:
        raise NOT_FOUND
    return movies
