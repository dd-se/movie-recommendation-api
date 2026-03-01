import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class SecuritySettings(BaseSettings):
    secret_key: str = Field(..., min_length=32)
    access_token_expire_days: int = Field(default=7, gt=0)
    jwt_algorithm: str = Field(default="HS256")
    cors_origins: list[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173"])

    @property
    def cors_origins_list(self) -> list[str]:
        return self.cors_origins

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class DatabaseSettings(BaseSettings):
    database_path: Path = Path(__file__).parent.parent.parent / "data" / "db"
    backup_path: Path = Path(__file__).parent.parent.parent / "data" / "db" / "backups"
    populate_db_path: Path = Path(__file__).parent.parent.parent / "data" / "populate_db"

    @field_validator("database_path", mode="before")
    @classmethod
    def ensure_database_path_exists(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator("backup_path", mode="before")
    @classmethod
    def ensure_backup_path_exists(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator("populate_db_path", mode="before")
    @classmethod
    def ensure_populate_db_path_exists(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path / 'movies.db'}"

    @property
    def database_file(self) -> Path:
        return self.database_path / "movies.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class TMDBSettings(BaseSettings):
    tmdb_api_key: str = Field(...)
    tmdb_base_url: str = Field(default="https://api.themoviedb.org/3")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class EmbeddingSettings(BaseSettings):
    vector_store_path: Path = Path(__file__).parent.parent.parent / "data" / "vector_store"
    embedding_model: str = Field(default="nomic-ai/nomic-embed-text-v1.5")
    use_cuda: bool = Field(default=False)
    embedding_batch_size: int = Field(default=5460, gt=0)

    @field_validator("vector_store_path", mode="before")
    @classmethod
    def ensure_vector_store_path_exists(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class LoggingSettings(BaseSettings):
    log_level: str = Field(default="INFO")
    log_dir: Path = Path(__file__).parent.parent.parent / "logs"

    @field_validator("log_dir", mode="before")
    @classmethod
    def ensure_log_dir_exists(cls, v: Path) -> Path:
        v.mkdir(parents=True, exist_ok=True)
        return v

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        if not hasattr(logging, v.upper()):
            return "INFO"
        return v.upper()

    @property
    def log_file(self) -> Path:
        return self.log_dir / "logs.txt"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class SchedulerSettings(BaseSettings):
    fetch_cron_hours: str = Field(default="0,4,8,12,16,20")
    refresh_cron_minutes: str = Field(default="0,5,10,20,30,35,40,50")
    preprocess_cron_minutes: str = Field(default="15,45")
    vector_store_cron_minutes: str = Field(default="25,55")
    refresh_limit: int = Field(default=10000, gt=0)
    max_retries: int = Field(default=2, ge=0)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class PopulateDBSettings(BaseSettings):
    latin_threshold: float = Field(default=0.9, ge=0.0, le=1.0)
    commit_interval: int = Field(default=50, gt=0)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")


class Settings(BaseSettings):
    app_name: str = Field(default="Movie Recommendation API")
    environment: str = Field(default="development")

    security: SecuritySettings = Field(default_factory=SecuritySettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    tmdb: TMDBSettings = Field(default_factory=TMDBSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    scheduler: SchedulerSettings = Field(default_factory=SchedulerSettings)
    populate_db: PopulateDBSettings = Field(default_factory=PopulateDBSettings)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
