from fastapi import APIRouter

from backend.api.deps import MovieServiceDep
from backend.api.schemas.movie import MovieFilter, MovieSchema
from backend.domain.errors import NotFoundError

router = APIRouter(prefix="/v1", tags=["v1"])


@router.post("/movie", summary="Get a movie recommendation")
def get_recommendation(movie_filter: MovieFilter, movie_service: MovieServiceDep) -> list[MovieSchema]:
    movies = movie_service.search(movie_filter)
    if not movies:
        raise NotFoundError()
    return movies
