from __future__ import annotations

from typing import TYPE_CHECKING, Any

from backend.core.logging import get_logger
from backend.infrastructure.db.models.movie import Movie
from backend.infrastructure.db.repositories.movie import MovieRepository
from backend.infrastructure.vector.chroma_store import ChromaVectorStore

if TYPE_CHECKING:
    from backend.api.schemas.movie import MovieFilter, MovieSchema

logger = get_logger(__name__)


class MovieQueryService:
    def __init__(self, movie_repo: MovieRepository, vector_store: ChromaVectorStore | None = None):
        self._movie_repo = movie_repo
        self._vector_store = vector_store

    def search(self, filters: MovieFilter, limit: int = 1) -> list[Movie] | list[dict[str, Any]]:
        """Search for movies. Returns list[Movie] for SQL path, list[dict] for ChromaDB path."""
        if filters.description:
            where, where_doc = self._build_chromadb_filters(filters)
            return self._vector_store.query(filters.description, where, where_doc, k=limit)
        return self._movie_repo.search(
            title=filters.title,
            release_date_from=filters.release_date_from,
            release_date_to=filters.release_date_to,
            runtime_min=filters.runtime_min or 70,
            runtime_max=filters.runtime_max,
            vote_average_min=filters.vote_average_min or 6.4,
            vote_count_min=filters.vote_count_min or 50,
            popularity_min=filters.popularity_min,
            genres=filters.genres or None,
            production_countries=filters.production_countries or None,
            keywords=filters.keywords or None,
            spoken_languages=filters.spoken_languages or None,
            cast=filters.cast or None,
            limit=limit,
        )

    def search_excluding(
        self, filters: MovieFilter, exclude_tmdb_ids: list[int] | None, limit: int = 1,
    ) -> list[Movie] | list[MovieSchema]:
        """Search excluding already-recommended movies. Same return type logic as search()."""
        if filters.description:
            where, where_doc = self._build_chromadb_filters(filters, exclude_tmdb_ids)
            raw = self._vector_store.query(filters.description, where, where_doc, k=limit)
            from backend.api.schemas.movie import movie_schema_list_adapter
            return movie_schema_list_adapter.validate_python(raw)
        return self._movie_repo.search(
            exclude_tmdb_ids=exclude_tmdb_ids,
            title=filters.title,
            release_date_from=filters.release_date_from,
            release_date_to=filters.release_date_to,
            runtime_min=filters.runtime_min or 70,
            runtime_max=filters.runtime_max,
            vote_average_min=filters.vote_average_min or 6.4,
            vote_count_min=filters.vote_count_min or 50,
            popularity_min=filters.popularity_min,
            genres=filters.genres or None,
            production_countries=filters.production_countries or None,
            keywords=filters.keywords or None,
            spoken_languages=filters.spoken_languages or None,
            cast=filters.cast or None,
            limit=limit,
        )

    def _build_chromadb_filters(
        self,
        filters: MovieFilter,
        exclude_tmdb_ids: list[int] | None = None,
        vote_average_min: float = 6.4,
        vote_count_min: int = 50,
        runtime_min: int = 70,
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        meta: list[dict[str, Any]] = []
        if exclude_tmdb_ids:
            meta.append({"tmdb_id": {"$nin": exclude_tmdb_ids}})
        meta.append({"vote_average": {"$gte": filters.vote_average_min or vote_average_min}})
        meta.append({"vote_count": {"$gt": filters.vote_count_min or vote_count_min}})
        meta.append({"runtime": {"$gte": filters.runtime_min or runtime_min}})
        if filters.release_date_from:
            meta.append({"release_date": {"$gte": int(filters.release_date_from.strftime("%Y%m%d"))}})
        if filters.release_date_to:
            meta.append({"release_date": {"$lte": int(filters.release_date_to.strftime("%Y%m%d"))}})
        if filters.runtime_max:
            meta.append({"runtime": {"$lte": filters.runtime_max}})
        if filters.popularity_min:
            meta.append({"popularity": {"$gte": filters.popularity_min}})
        if filters.title or filters.cast:
            tmdb_ids = self._movie_repo.find_tmdb_ids_by_filters(
                filters.title, filters.cast or None
            )
            meta.append({"tmdb_id": {"$in": tmdb_ids}})

        docs: list[dict[str, str]] = []
        for fn, vals in [
            (str.title, filters.genres),
            (str.title, filters.spoken_languages),
            (str.title, filters.production_countries),
            (str.lower, filters.keywords),
        ]:
            for v in vals:
                cond, v = ("$not_contains", v[1:]) if v.startswith("!") else ("$contains", v)
                docs.append({cond: fn(v)})

        where = {"$and": meta} if len(meta) > 1 else (meta[0] if meta else None)
        where_doc = {"$and": docs} if len(docs) > 1 else (docs[0] if docs else None)
        return where, where_doc
