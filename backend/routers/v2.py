from fastapi import APIRouter
from sqlalchemy import delete

from ..core.database import ApiSession
from ..core.exceptions import NOT_FOUND
from ..core.security import AuthedUser_MR
from ..models.user import MovieRecommendation
from ..schemas.common import DetailResponse
from ..schemas.movie import MovieFilter, MovieSchema, MovieSearch

router = APIRouter(prefix="/v2", tags=["v2"])


@router.post("/movie", summary="Get a movie not recommended twice")
def get_movie_not_recommended_twice(movie_filter: MovieFilter, user: AuthedUser_MR, db: ApiSession) -> list[MovieSchema]:
    exclude_tmdb_ids = [rec.tmdb_id for rec in user.recommendations]
    movies = movie_filter.get_movie_not_recommended_twice(db, exclude_tmdb_ids)
    if not movies:
        raise NOT_FOUND
    db.add_all(MovieRecommendation(user_id=user.id, tmdb_id=movie.tmdb_id) for movie in movies)
    db.commit()
    return movies


@router.post("/search", summary="Search for movies")
def search_movie(movie_search: MovieSearch, _: AuthedUser_MR, db: ApiSession) -> list[MovieSchema]:
    movies = movie_search.get_movie(db, movie_search.n_results)
    if not movies:
        raise NOT_FOUND
    return movies


@router.post("/user/forget-recommends", summary="Forget movie recommendations")
def forget_user_recommendations(user: AuthedUser_MR, db: ApiSession) -> DetailResponse:
    result = db.execute(delete(MovieRecommendation).where(MovieRecommendation.user_id == user.id))
    if result.rowcount == 0:
        raise NOT_FOUND
    db.commit()
    return DetailResponse(detail="User recommendations have been deleted.")
