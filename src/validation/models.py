from datetime import date, datetime
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PrivateAttr,
    StringConstraints,
    TypeAdapter,
    ValidationInfo,
    field_validator,
    model_validator,
)
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import InstrumentedAttribute

from ..logger import get_logger
from ..storage.db import ApiSession, Movie
from ..storage.vector_store import get_relevant_movies

logger = get_logger(__name__)


class MovieBase(BaseModel):
    """Our validation model for transforming the TMDB API data for storage in the database."""

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

        # TMDB keeps 'null' string values as ""
        fields_of_interest = {}
        fields_of_interest["tmdb_id"] = data.get("id")
        fields_of_interest["title"] = data.get("title") if data.get("title") else None
        fields_of_interest["status"] = data.get("status") if data.get("status") else None
        fields_of_interest["release_date"] = data.get("release_date") if data.get("release_date") else None
        fields_of_interest["poster_path"] = data.get("poster_path") if data.get("poster_path") else None
        fields_of_interest["runtime"] = data.get("runtime")
        fields_of_interest["overview"] = data.get("overview") if data.get("overview") else None
        fields_of_interest["popularity"] = data.get("popularity")
        fields_of_interest["vote_average"] = data.get("vote_average")
        fields_of_interest["vote_count"] = data.get("vote_count")
        fields_of_interest["tagline"] = data.get("tagline") if data.get("tagline") else None

        if genres := data.get("genres"):
            fields_of_interest["genres"] = ", ".join(g["name"] for g in genres)

        if langs := data.get("spoken_languages"):
            fields_of_interest["spoken_languages"] = ", ".join(l["english_name"] for l in langs)

        if companies := data.get("production_companies"):
            fields_of_interest["production_companies"] = ", ".join(c["name"] for c in companies)

        if countries := data.get("production_countries"):
            fields_of_interest["production_countries"] = ", ".join(c["name"] for c in countries)

        if keywords := data.get("keywords"):
            if keywords := keywords.get("keywords"):
                fields_of_interest["keywords"] = ", ".join(k["name"] for k in keywords)

        if credits := data.get("credits"):
            if actors := credits.get("cast"):
                fields_of_interest["cast"] = ", ".join(a["name"] for a in actors[:5])

        return fields_of_interest

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
    """Our response model for a movie stored in our database."""

    tmdb_id: Annotated[int, Field(description="The unique identifier for the movie from TMDb.", examples=[24428])]
    title: Annotated[str, Field(description="The title of the movie.", examples=["The Avengers"])]
    release_date: Annotated[date | None, Field(description="The release date of the movie.", examples=["2012-04-25"])] = None
    status: Annotated[str | None, Field(description="The release status of the movie.", examples=["Released"])] = None
    runtime: Annotated[int | None, Field(description="The runtime of the movie in minutes.", examples=[143])] = None
    vote_average: Annotated[float | None, Field(description="The average user rating for the movie.", examples=[7.801])] = (
        None
    )
    vote_count: Annotated[
        int | None, Field(description="The total number of votes the movie has received.", examples=[32988])
    ] = None
    popularity: Annotated[float | None, Field(description="The popularity score of the movie.", examples=[41.9463])] = None
    genres: Annotated[
        str | None,
        Field(description="A comma-separated list of genres for the movie.", examples=["Drama, Action, Adventure"]),
    ] = None
    cast: Annotated[
        str | None,
        Field(
            default=None,
            description="A list of top 5 cast members.",
            examples=["Robert Downey Jr., Chris Evans, Mark Ruffalo, Chris Hemsworth, Scarlett Johansson"],
        ),
    ] = None
    overview: Annotated[
        str | None,
        Field(description="A brief summary of the movie's plot.", examples=["When an unexpected enemy emerges..."]),
    ] = None
    poster_path: Annotated[
        str | None, Field(description="The path to the movie's poster image.", examples=["/RYMX2wcKCBArwmjaTn.jpg"])
    ] = None

    @field_validator("release_date", mode="before")
    @classmethod
    def format_release_date(cls, value) -> date | None:
        """Helper for formatting release_date from 'YYYYMMDD' to 'YYYY-MM-DD'. ChromaDB stores dates as integers."""
        if value is None or isinstance(value, date):
            return value
        try:
            value = str(value)
            return date.fromisoformat(f"{value[:4]}-{value[4:6]}-{value[6:]}")
        except Exception:
            raise ValueError(f"Invalid date format for '{value}'. Expected 'YYYYMMDD'.")


movie_schema_list_adapter = TypeAdapter(list[MovieSchema])


class MovieFilter(BaseModel):
    """User input model for filtering movies from our database."""

    model_config = ConfigDict(str_strip_whitespace=True, str_min_length=1, extra="forbid")

    description: Annotated[
        str | None, Field(description="Semantic search query.", examples=["a computer hacker", "a journey to a new world"])
    ] = None

    title: Annotated[str | None, Field(description="Movie title.", examples=["WarGames"])] = None

    release_date_from: Annotated[
        date | None, Field(description="The earliest release date for a movie.", examples=["1999-01-01"])
    ] = None

    release_date_to: Annotated[
        date | None, Field(description="The latest release date for a movie.", examples=["2005-12-31"])
    ] = None

    runtime_min: Annotated[
        int | None,
        Field(
            description="The minimum runtime of the movie in minutes.",
            examples=[90],
            gt=0,
        ),
    ] = None

    runtime_max: Annotated[
        int | None,
        Field(
            description="The maximum runtime of the movie in minutes.",
            examples=[180],
            gt=0,
        ),
    ] = None

    vote_average_min: Annotated[
        float | None,
        Field(description="The minimum average user vote on a scale of 0-10.", examples=[6.5], ge=0, le=10),
    ] = None

    popularity_min: Annotated[
        float | None,
        Field(description="The minimum popularity score.", examples=[10.0], ge=0),
    ] = None

    genres: Annotated[
        list[str],
        Field(
            description="A list of genres.",
            examples=[["Thriller", "Science Fiction"]],
            default_factory=list,
        ),
    ]

    production_countries: Annotated[
        list[str],
        Field(
            description="A list of production countries.",
            examples=[["United States", "Sweden"]],
            default_factory=list,
        ),
    ]

    keywords: Annotated[
        list[str],
        Field(
            description="A list of keywords associated with the movie.",
            examples=[["artificial intelligence", "hacker"]],
            default_factory=list,
        ),
    ]

    spoken_languages: Annotated[
        list[str],
        Field(description="A list of spoken languages.", examples=[["English", "Turkish"]], default_factory=list),
    ]

    cast: Annotated[
        list[str],
        Field(
            description="A list of actor names.",
            examples=[["Matthew Broderick", "Dabney Coleman"]],
            default_factory=list,
        ),
    ]

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

    def get_movie(self, db: ApiSession, limit: int = 1):
        """
        Fetches a movie based on the provided filters.
        If a description is provided, it uses semantic search via ChromaDB.
        Otherwise, it constructs a SQL query based on the other filters.
        """
        if self._has_description:
            where_filter, where_document_filter = self._build_chromadb_query(db)
            relevant_movies = get_relevant_movies(self.description, where_filter, where_document_filter, limit)
        else:
            query = self._build_sql_query(None, limit=limit)
            logger.debug(f"Generated SQL Query: {query.compile(compile_kwargs={'literal_binds': True})}")
            relevant_movies = db.execute(query).scalars().all()

        return relevant_movies

    def get_movie_not_recommended_twice(self, db: ApiSession, exclude_tmdb_ids: list[int] | None = None, limit: int = 1):
        """
        Fetches a movie based on the provided filters, ensuring it hasn't been recommended before.
        If a description is provided, it uses semantic search via ChromaDB.
        Otherwise, it constructs a SQL query based on the other filters.
        """
        if self._has_description:
            where_filter, where_document_filter = self._build_chromadb_query(db, exclude_tmdb_ids)
            relevant_movies = get_relevant_movies(self.description, where_filter, where_document_filter, limit)
            relevant_movies = movie_schema_list_adapter.validate_python(relevant_movies)
        else:
            query = self._build_sql_query(exclude_tmdb_ids, negation=True, limit=limit)
            relevant_movies = db.execute(query).scalars().all()
            logger.debug(f"Generated SQL Query: {query.compile(compile_kwargs={'literal_binds': True})}")

        return relevant_movies

    def _build_chromadb_query(
        self,
        db: ApiSession,
        exclude_tmdb_ids: list[int] | None = None,
        vote_average_min: float = 6.4,
        vote_count_gt: int = 50,
        runtime_min: int = 70,
    ) -> tuple[dict | None, dict | None]:
        metadata_filters = []

        if exclude_tmdb_ids:
            metadata_filters.append({"tmdb_id": {"$nin": exclude_tmdb_ids}})

        metadata_filters.append({"vote_average": {"$gte": self.vote_average_min or vote_average_min}})
        metadata_filters.append({"vote_count": {"$gt": vote_count_gt}})
        metadata_filters.append({"runtime": {"$gte": self.runtime_min or runtime_min}})

        if self.release_date_from:
            metadata_filters.append({"release_date": {"$gte": int(self.release_date_from.strftime("%Y%m%d"))}})

        if self.release_date_to:
            metadata_filters.append({"release_date": {"$lte": int(self.release_date_to.strftime("%Y%m%d"))}})

        if self.runtime_max:
            metadata_filters.append({"runtime": {"$lte": self.runtime_max}})

        if self.popularity_min:
            metadata_filters.append({"popularity": {"$gte": self.popularity_min}})

        if self.title or self.cast:
            q = select(Movie.tmdb_id)
            if self.title:
                q = q.where(Movie.title.icontains(self.title))

            if self.cast:
                q = self._build_sql_query_helper(q, Movie.cast, self.cast)

            tmdb_ids = db.execute(q).scalars().all()
            metadata_filters.append({"tmdb_id": {"$in": tmdb_ids}})

        document_filters = []
        for str_method, list_attr in [
            (str.title, self.genres),
            (str.title, self.spoken_languages),
            (str.title, self.production_countries),
            (str.lower, self.keywords),
        ]:
            if list_attr:
                for value in list_attr:
                    cond = "$contains"
                    if value.startswith("!"):
                        cond = "$not_contains"
                        value = value[1:]
                    document_filters.append({cond: str_method(value)})

        where_filter = None
        if metadata_filters:
            if len(metadata_filters) == 1:
                where_filter = metadata_filters[0]
            else:
                where_filter = {"$and": metadata_filters}

        where_document_filter = None
        if document_filters:
            if len(document_filters) == 1:
                where_document_filter = document_filters[0]
            else:
                where_document_filter = {"$and": document_filters}

        return (where_filter, where_document_filter)

    def _build_sql_query(
        self,
        tmdb_ids: list[int],
        negation: bool = False,
        limit: int = 1,
        vote_average_min: float = 6.4,
        vote_count_gt: int = 50,
        runtime_min: int = 70,
    ) -> Select[tuple[Movie]]:
        q = select(Movie).limit(limit)

        if tmdb_ids:
            if negation:
                q = q.where(Movie.tmdb_id.not_in(tmdb_ids))
            else:
                q = q.where(Movie.tmdb_id.in_(tmdb_ids))

        if not self._has_description:
            q = q.where(Movie.vote_count > vote_count_gt).order_by(
                ((Movie.vote_average * Movie.vote_count) / (Movie.vote_count + 100)).desc(),
                Movie.vote_count.desc(),
                Movie.popularity.desc(),
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

            r_min = self.runtime_min or runtime_min
            q = q.where(Movie.runtime >= r_min)

            if self.runtime_max:
                q = q.where(Movie.runtime <= self.runtime_max)

            v_min = self.vote_average_min or vote_average_min
            q = q.where(Movie.vote_average >= v_min)

            if self.popularity_min:
                q = q.where(Movie.popularity >= self.popularity_min)

            if self.genres:
                q = self._build_sql_query_helper(q, Movie.genres, self.genres)

            if self.production_countries:
                q = self._build_sql_query_helper(q, Movie.production_countries, self.production_countries)

            if self.keywords:
                q = self._build_sql_query_helper(q, Movie.keywords, self.keywords)

            if self.spoken_languages:
                q = self._build_sql_query_helper(q, Movie.spoken_languages, self.spoken_languages)

            if self.cast:
                q = self._build_sql_query_helper(q, Movie.cast, self.cast)

        return q

    def _build_sql_query_helper(self, query: Select, attribute: InstrumentedAttribute, values: list[str]) -> Select:
        conditions = []

        for value in values:
            if value.startswith("!"):
                value = value[1:]
                conditions.append(~attribute.icontains(value))
            else:
                conditions.append(attribute.icontains(value))

        return query.where(and_(*conditions))


class MovieSearch(MovieFilter):
    n_results: int = Field(description="Number of results to return", gt=0, le=21, default=5)


# AUTH.py pydantic models
class ApiTokenSchema(BaseModel):
    access_token: str
    token_type: str


class UserBase(BaseModel):
    email: EmailStr


class ValidateTokenData(UserBase):
    scopes: list[str]
    access_token_expires: datetime


class UserCreate(UserBase):
    password: Annotated[str, StringConstraints(min_length=2, max_length=15, strip_whitespace=True)]


class UserSchema(UserBase):
    access_token_scopes: list[str] | None
    access_token_expires: datetime | None
