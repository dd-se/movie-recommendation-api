from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    disabled: bool
    scopes: str


class AdminUserList(BaseModel):
    users: list[AdminUserItem]
    total: int
    page: int
    per_page: int


class UpdateScopesRequest(BaseModel):
    scopes: list[str]


class UpdateStatusRequest(BaseModel):
    disabled: bool


class QueueItem(BaseModel):
    id: int
    tmdb_id: int
    title: str | None = None
    status: str
    retries: int
    message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class QueueList(BaseModel):
    items: list[QueueItem]
    total: int
    page: int
    per_page: int


class QueueRefreshRequest(BaseModel):
    status: str
    message: str | None = None
    movie_ids: list[int] | None = None


class BackupItem(BaseModel):
    filename: str
    size_bytes: int
    created_at: str


class SchedulerJobItem(BaseModel):
    job_id: str
    name: str
    next_run_time: str | None = None
    trigger: str


class SystemStats(BaseModel):
    total_movies: int
    total_users: int
    active_users: int
    disabled_users: int
    total_queue: int
    queue_by_status: dict[str, int]
    total_backups: int
