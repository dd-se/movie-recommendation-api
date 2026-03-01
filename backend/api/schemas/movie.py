from datetime import date
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    field_validator,
    model_validator,
)


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

    @model_validator(mode="after")
    def _check_instance_has_any_filters(self) -> Self:
        movie_filters = self.model_dump(exclude_unset=True)
        if not movie_filters:
            raise ValueError("At least one filter must be provided to search for movies.")
        movie_filters.pop("n_results", None)
        return self


class MovieSearch(MovieFilter):
    n_results: int = Field(description="Number of results to return", gt=0, le=21, default=5)
