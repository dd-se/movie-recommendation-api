from fastapi import APIRouter, Depends
from sqlalchemy import select

from ...storage.db import ApiSession, Movie, MovieRecommendation, User
from ...validation import MovieFilter, MovieSchema, MovieSearch, movie_schema_list_adapter
from ..auth import AuthedUser_MR, AuthedUser_MW
from ..exceptions import NOT_FOUND

movie_router = APIRouter(tags=["movie"])


@movie_router.post("/movie", summary="Get a movie not recommended twice", response_model=list[MovieSchema])
async def get_movie_not_recommended_twice(movie_filter: MovieFilter, user: AuthedUser_MR, db: ApiSession):
    exclude_tmdb_ids = [rec.tmdb_id for rec in user.recommendations]
    movies = movie_filter.get_movie_not_recommended_twice(db, exclude_tmdb_ids)

    if not movies:
        raise NOT_FOUND

    db.add_all((MovieRecommendation(user_id=user.id, tmdb_id=movie.tmdb_id) for movie in movies))
    db.commit()
    return movies


@movie_router.post("/search", summary="Search for movies", response_model=list[MovieSchema])
async def search_movie(movie_search: MovieSearch, _: AuthedUser_MR, db: ApiSession):
    movies = movie_search.get_movie(db, movie_search.n_results)
    if not movies:
        raise NOT_FOUND
    return movies
