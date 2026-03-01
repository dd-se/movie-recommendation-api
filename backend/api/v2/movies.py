from fastapi import APIRouter

from ...storage.db import ApiSession, MovieRecommendation
from ...validation import MovieFilter, MovieSchema, MovieSearch
from ..auth import AuthedUser_MR
from ..exceptions import NOT_FOUND

movie_router = APIRouter(tags=["movie"])


@movie_router.post("/movie", summary="Get a movie not recommended twice")
def get_movie_not_recommended_twice(movie_filter: MovieFilter, user: AuthedUser_MR, db: ApiSession) -> list[MovieSchema]:
    exclude_tmdb_ids = [rec.tmdb_id for rec in user.recommendations]
    movies = movie_filter.get_movie_not_recommended_twice(db, exclude_tmdb_ids)

    if not movies:
        raise NOT_FOUND

    db.add_all((MovieRecommendation(user_id=user.id, tmdb_id=movie.tmdb_id) for movie in movies))
    db.commit()
    return movies


@movie_router.post("/search", summary="Search for movies")
def search_movie(movie_search: MovieSearch, _: AuthedUser_MR, db: ApiSession) -> list[MovieSchema]:
    movies = movie_search.get_movie(db, movie_search.n_results)
    if not movies:
        raise NOT_FOUND
    return movies
