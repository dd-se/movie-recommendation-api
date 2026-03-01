from fastapi import APIRouter

from backend.api.deps import AuthedUser_MR, DbSession, MovieServiceDep, RecommendationRepoDep
from backend.api.schemas.common import DetailResponse
from backend.api.schemas.movie import MovieFilter, MovieSchema, MovieSearch
from backend.domain.errors import NotFoundError
from backend.infrastructure.db.models.user import MovieRecommendation

router = APIRouter(prefix="/v2", tags=["v2"])


@router.post("/movie", summary="Get a movie not recommended twice")
def get_movie_not_recommended_twice(
    movie_filter: MovieFilter,
    user: AuthedUser_MR,
    session: DbSession,
    movie_service: MovieServiceDep,
    rec_repo: RecommendationRepoDep,
) -> list[MovieSchema]:
    exclude_tmdb_ids = [rec.tmdb_id for rec in user.recommendations]
    movies = movie_service.search_excluding(movie_filter, exclude_tmdb_ids)
    if not movies:
        raise NotFoundError()
    rec_repo.add_all([MovieRecommendation(user_id=user.id, tmdb_id=movie.tmdb_id) for movie in movies])
    session.commit()
    return movies


@router.post("/search", summary="Search for movies")
def search_movie(movie_search: MovieSearch, _: AuthedUser_MR, movie_service: MovieServiceDep) -> list[MovieSchema]:
    movies = movie_service.search(movie_search, movie_search.n_results)
    if not movies:
        raise NotFoundError()
    return movies


@router.post("/user/forget-recommends", summary="Forget movie recommendations")
def forget_user_recommendations(
    user: AuthedUser_MR, rec_repo: RecommendationRepoDep, session: DbSession,
) -> DetailResponse:
    count = rec_repo.delete_for_user(user.id)
    if count == 0:
        raise NotFoundError()
    session.commit()
    return DetailResponse(detail="User recommendations have been deleted.")
