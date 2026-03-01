from datetime import date
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PrivateAttr,
    TypeAdapter,
    field_validator,
    model_validator,
)
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import InstrumentedAttribute

from ..core.database import ApiSession
from ..core.logging import get_logger
from ..models.movie import Movie
from ..services.vector_store import get_relevant_movies

logger = get_logger(__name__)


class MovieBase(BaseModel):
    """Validation model for transforming TMDB API data for storage."""

    model_config = ConfigDict(str_strip_whitespace=True, str_min_length=1)

    tmdb_id: int
    title: str
    status: str | None = None
    release_date: date | None = None
    poster_path: str | None = None
    runtime: int | None = None
    overview: str | None = None
    popularity: float | None = None
    vote_average: float | None = None
    vote_count: int | None = None
    genres: str | None = None
    spoken_languages: str | None = None
    production_companies: str | None = None
    production_countries: str | None = None
    keywords: str | None = None
    tagline: str | None = None
    cast: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _process_api_data(cls, data: dict) -> Any:
        if not isinstance(data, dict):
            return data

        foi: dict[str, Any] = {}
        foi["tmdb_id"] = data.get("id")
        foi["title"] = data.get("title") or None
        foi["status"] = data.get("status") or None
        foi["release_date"] = data.get("release_date") or None
        foi["poster_path"] = data.get("poster_path") or None
        foi["runtime"] = data.get("runtime")
        foi["overview"] = data.get("overview") or None
        foi["popularity"] = data.get("popularity")
        foi["vote_average"] = data.get("vote_average")
        foi["vote_count"] = data.get("vote_count")
        foi["tagline"] = data.get("tagline") or None

        if genres := data.get("genres"):
            foi["genres"] = ", ".join(g["name"] for g in genres)
        if langs := data.get("spoken_languages"):
            foi["spoken_languages"] = ", ".join(l["english_name"] for l in langs)
        if companies := data.get("production_companies"):
            foi["production_companies"] = ", ".join(c["name"] for c in companies)
        if countries := data.get("production_countries"):
            foi["production_countries"] = ", ".join(c["name"] for c in countries)
        if keywords := data.get("keywords"):
            if keywords := keywords.get("keywords"):
                foi["keywords"] = ", ".join(k["name"] for k in keywords)
        if credits := data.get("credits"):
            if actors := credits.get("cast"):
                foi["cast"] = ", ".join(a["name"] for a in actors[:5])

        return foi

    def is_my_kind_of_movie(self) -> bool:
        if not self.genres or not self.spoken_languages:
            return False
        langs = self.spoken_languages.lower().split(", ")
        genres = self.genres.lower().split(", ")
        has_my_lang = "english" in langs or "turkish" in langs or "swedish" in langs
        is_not_documentary_or_music = ["documentary"] != genres and ["music"] != genres
        has_not_documentary_and_music = not ("documentary" in genres and "music" in genres)
        return has_my_lang and is_not_documentary_or_music and has_not_documentary_and_music


class MovieCreate(MovieBase):
    pass


class MovieSchema(BaseModel):
    """Response model for a movie stored in the database."""

    model_config = ConfigDict(from_attributes=True)

    tmdb_id: Annotated[int, Field(description="TMDB ID.", examples=[24428])]
    title: Annotated[str, Field(description="Movie title.", examples=["The Avengers"])]
    release_date: Annotated[date | None, Field(description="Release date.", examples=["2012-04-25"])] = None
    status: Annotated[str | None, Field(description="Release status.", examples=["Released"])] = None
    runtime: Annotated[int | None, Field(description="Runtime in minutes.", examples=[143])] = None
    vote_average: Annotated[float | None, Field(description="Average rating.", examples=[7.801])] = None
    vote_count: Annotated[int | None, Field(description="Total votes.", examples=[32988])] = None
    popularity: Annotated[float | None, Field(description="Popularity score.", examples=[41.9463])] = None
    genres: Annotated[str | None, Field(description="Genres.", examples=["Drama, Action, Adventure"])] = None
    cast: Annotated[str | None, Field(description="Top 5 cast.", examples=["Robert Downey Jr., Chris Evans"])] = None
    overview: Annotated[str | None, Field(description="Plot summary.", examples=["When an unexpected enemy emerges..."])] = None
    poster_path: Annotated[str | None, Field(description="Poster path.", examples=["/RYMX2wcKCBArwmjaTn.jpg"])] = None

    @field_validator("release_date", mode="before")
    @classmethod
    def format_release_date(cls, value: Any) -> date | None:
        if value is None or isinstance(value, date):
            return value
        try:
            value = str(value)
            return date.fromisoformat(f"{value[:4]}-{value[4:6]}-{value[6:]}")
        except Exception:
            raise ValueError(f"Invalid date format for '{value}'. Expected 'YYYYMMDD'.")


movie_schema_list_adapter = TypeAdapter(list[MovieSchema])


class MovieFilter(BaseModel):
    """User input model for filtering movies."""

    model_config = ConfigDict(str_strip_whitespace=True, str_min_length=1, extra="forbid")

    description: Annotated[str | None, Field(description="Semantic search query.", examples=["a computer hacker"])] = None
    title: Annotated[str | None, Field(description="Movie title.", examples=["WarGames"])] = None
    release_date_from: Annotated[date | None, Field(description="Earliest release date.", examples=["1999-01-01"])] = None
    release_date_to: Annotated[date | None, Field(description="Latest release date.", examples=["2005-12-31"])] = None
    runtime_min: Annotated[int | None, Field(description="Min runtime.", examples=[90], gt=0)] = None
    runtime_max: Annotated[int | None, Field(description="Max runtime.", examples=[180], gt=0)] = None
    vote_average_min: Annotated[float | None, Field(description="Min vote average.", examples=[6.5], ge=0, le=10)] = None
    vote_count_min: Annotated[int | None, Field(description="Min vote count.", examples=[100], ge=0)] = None
    popularity_min: Annotated[float | None, Field(description="Min popularity.", examples=[10.0], ge=0)] = None
    genres: Annotated[list[str], Field(description="Genres.", examples=[["Thriller"]], default_factory=list)]
    production_countries: Annotated[list[str], Field(description="Countries.", examples=[["United States"]], default_factory=list)]
    keywords: Annotated[list[str], Field(description="Keywords.", examples=[["hacker"]], default_factory=list)]
    spoken_languages: Annotated[list[str], Field(description="Languages.", examples=[["English"]], default_factory=list)]
    cast: Annotated[list[str], Field(description="Actors.", examples=[["Brad Pitt"]], default_factory=list)]

    _recommended_movies: list[Movie] = PrivateAttr(default_factory=list)
    _has_description: bool = PrivateAttr(default=False)
    _has_filters: bool = PrivateAttr(default=False)

    @model_validator(mode="after")
    def _check_instance_has_any_filters(self) -> Self:
        movie_filters = self.model_dump(exclude_unset=True)
        if not movie_filters:
            raise ValueError("At least one filter must be provided to search for movies.")
        movie_filters.pop("n_results", None)
        description = movie_filters.pop("description", None)
        if description:
            self._has_description = True
        if movie_filters:
            self._has_filters = True
        return self

    def get_movie(self, db: ApiSession, limit: int = 1) -> list[Movie]:
        if self._has_description:
            where_filter, where_doc = self._build_chromadb_query(db)
            return get_relevant_movies(self.description, where_filter, where_doc, limit)
        query = self._build_sql_query(None, limit=limit)
        logger.debug(f"SQL: {query.compile(compile_kwargs={'literal_binds': True})}")
        return db.execute(query).scalars().all()

    def get_movie_not_recommended_twice(
        self, db: ApiSession, exclude_tmdb_ids: list[int] | None = None, limit: int = 1,
    ) -> list[Movie] | list[MovieSchema]:
        if self._has_description:
            where_filter, where_doc = self._build_chromadb_query(db, exclude_tmdb_ids)
            raw = get_relevant_movies(self.description, where_filter, where_doc, limit)
            return movie_schema_list_adapter.validate_python(raw)
        query = self._build_sql_query(exclude_tmdb_ids, negation=True, limit=limit)
        logger.debug(f"SQL: {query.compile(compile_kwargs={'literal_binds': True})}")
        return db.execute(query).scalars().all()

    # ── Private query builders ────────────────────────────────────────

    def _build_chromadb_query(
        self, db: ApiSession, exclude_tmdb_ids: list[int] | None = None,
        vote_average_min: float = 6.4, vote_count_min: int = 50, runtime_min: int = 70,
    ) -> tuple[dict | None, dict | None]:
        meta: list[dict] = []
        if exclude_tmdb_ids:
            meta.append({"tmdb_id": {"$nin": exclude_tmdb_ids}})
        meta.append({"vote_average": {"$gte": self.vote_average_min or vote_average_min}})
        meta.append({"vote_count": {"$gt": self.vote_count_min or vote_count_min}})
        meta.append({"runtime": {"$gte": self.runtime_min or runtime_min}})
        if self.release_date_from:
            meta.append({"release_date": {"$gte": int(self.release_date_from.strftime("%Y%m%d"))}})
        if self.release_date_to:
            meta.append({"release_date": {"$lte": int(self.release_date_to.strftime("%Y%m%d"))}})
        if self.runtime_max:
            meta.append({"runtime": {"$lte": self.runtime_max}})
        if self.popularity_min:
            meta.append({"popularity": {"$gte": self.popularity_min}})
        if self.title or self.cast:
            q = select(Movie.tmdb_id)
            if self.title:
                q = q.where(Movie.title.icontains(self.title))
            if self.cast:
                q = self._sql_helper(q, Movie.cast, self.cast)
            meta.append({"tmdb_id": {"$in": db.execute(q).scalars().all()}})

        docs: list[dict] = []
        for fn, vals in [(str.title, self.genres), (str.title, self.spoken_languages),
                         (str.title, self.production_countries), (str.lower, self.keywords)]:
            for v in vals:
                cond, v = ("$not_contains", v[1:]) if v.startswith("!") else ("$contains", v)
                docs.append({cond: fn(v)})

        where = {"$and": meta} if len(meta) > 1 else (meta[0] if meta else None)
        where_doc = {"$and": docs} if len(docs) > 1 else (docs[0] if docs else None)
        return where, where_doc

    def _build_sql_query(
        self, tmdb_ids: list[int] | None, negation: bool = False, limit: int = 1,
        vote_average_min: float = 6.4, vote_count_min: int = 50, runtime_min: int = 70,
    ) -> Select[tuple[Movie]]:
        q = select(Movie).limit(limit)
        if tmdb_ids:
            q = q.where(Movie.tmdb_id.not_in(tmdb_ids) if negation else Movie.tmdb_id.in_(tmdb_ids))
        if not self._has_description:
            vc = self.vote_count_min or vote_count_min
            q = q.where(Movie.vote_count > vc).order_by(
                ((Movie.vote_average * Movie.vote_count) / (Movie.vote_count + 100)).desc(),
                Movie.vote_count.desc(), Movie.popularity.desc(),
            )
        if not self._has_filters:
            return q
        if self.title:
            q = q.where(Movie.title.icontains(self.title))
        if not self._has_description:
            if self.release_date_from:
                q = q.where(Movie.release_date >= self.release_date_from)
            if self.release_date_to:
                q = q.where(Movie.release_date <= self.release_date_to)
            q = q.where(Movie.runtime >= (self.runtime_min or runtime_min))
            if self.runtime_max:
                q = q.where(Movie.runtime <= self.runtime_max)
            q = q.where(Movie.vote_average >= (self.vote_average_min or vote_average_min))
            if self.popularity_min:
                q = q.where(Movie.popularity >= self.popularity_min)
            for attr, vals in [(Movie.genres, self.genres), (Movie.production_countries, self.production_countries),
                               (Movie.keywords, self.keywords), (Movie.spoken_languages, self.spoken_languages),
                               (Movie.cast, self.cast)]:
                if vals:
                    q = self._sql_helper(q, attr, vals)
        return q

    @staticmethod
    def _sql_helper(query: Select, attribute: InstrumentedAttribute, values: list[str]) -> Select:
        conditions = []
        for v in values:
            if v.startswith("!"):
                conditions.append(~attribute.icontains(v[1:]))
            else:
                conditions.append(attribute.icontains(v))
        return query.where(and_(*conditions))


class MovieSearch(MovieFilter):
    n_results: int = Field(description="Number of results to return", gt=0, le=21, default=5)
