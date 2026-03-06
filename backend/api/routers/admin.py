import os
import sys
import time
from collections import deque
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request, status

from backend.api.deps import AuthedUser_MW, DbSession, MovieRepoDep, QueueRepoDep, UserRepoDep
from backend.api.schemas.admin import (
    AdminUserItem,
    AdminUserList,
    BackupItem,
    LogsResponse,
    QueueItem,
    QueueList,
    QueueRefreshRequest,
    SchedulerJobItem,
    SystemInfo,
    SystemStats,
    TmdbKeyResponse,
    UpdateScopesRequest,
    UpdateStatusRequest,
    UpdateTmdbKeyRequest,
)
from backend.api.schemas.common import BackupResponse, DetailResponse, QueueRefreshResponse, ScopeUpdateResponse
from backend.core.settings import get_settings
from backend.domain.errors import NotFoundError
from backend.infrastructure.backup.backup_service import backup_db
from backend.infrastructure.db.models import MovieQueue, QueueStatus

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_SCOPES = {"movie:read", "movie:write"}

_start_time = time.monotonic()


def _get_dir_size(path: str) -> int:
    total = 0
    try:
        for dirpath, _dirnames, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    except OSError:
        pass
    return total


# ── Sync ──────────────────────────────────────────────────────────────────

@router.get("/sync", summary="Sync Movie and MovieQueue tables", status_code=status.HTTP_200_OK)
def sync_tables(admin: AuthedUser_MW, queue_repo: QueueRepoDep, session: DbSession) -> DetailResponse:
    movies = queue_repo.find_movies_without_queue()
    if not movies:
        raise NotFoundError()
    for movie in movies:
        queue_repo.add(MovieQueue(tmdb_id=movie.tmdb_id))
    session.commit()
    return DetailResponse(detail=f"Recreated '{len(movies)}' missing MovieQueue entries.")


# ── Users ─────────────────────────────────────────────────────────────────

@router.get("/users", summary="List all users")
def list_users(
    admin: AuthedUser_MW,
    user_repo: UserRepoDep,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Filter by email"),
) -> AdminUserList:
    users, total = user_repo.list_paginated(page=page, per_page=per_page, search=search)
    return AdminUserList(
        users=[AdminUserItem.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.patch("/users/{user_id}/scopes", summary="Update user scopes")
def update_user_scopes(
    user_id: int, body: UpdateScopesRequest, admin: AuthedUser_MW, user_repo: UserRepoDep, session: DbSession,
) -> ScopeUpdateResponse:
    if invalid := [s for s in body.scopes if s not in VALID_SCOPES]:
        raise HTTPException(status_code=400, detail=f"Invalid scope(s): {', '.join(invalid)}")
    if not body.scopes:
        raise HTTPException(status_code=400, detail="At least one scope is required")
    user = user_repo.find_by_id(user_id)
    if not user:
        raise NotFoundError()
    user.scopes = " ".join(body.scopes)
    session.commit()
    return ScopeUpdateResponse(detail=f"Scopes updated for {user.email}", scopes=user.scopes)


@router.patch("/users/{user_id}/status", summary="Enable or disable a user")
def update_user_status(
    user_id: int, body: UpdateStatusRequest, admin: AuthedUser_MW, user_repo: UserRepoDep, session: DbSession,
) -> DetailResponse:
    user = user_repo.find_by_id(user_id)
    if not user:
        raise NotFoundError()
    if user.email == admin.email:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    user.disabled = body.disabled
    session.commit()
    return DetailResponse(detail=f"User {user.email} has been {'disabled' if body.disabled else 'enabled'}")


# ── Database ──────────────────────────────────────────────────────────────

@router.post("/backup", summary="Create a database backup")
def create_backup(admin: AuthedUser_MW) -> BackupResponse:
    settings = get_settings()
    try:
        backup_db(settings.database.database_file, settings.database.backup_path)
        backups = sorted(settings.database.backup_path.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
        latest = backups[0] if backups else None
        return BackupResponse(
            detail="Backup created successfully",
            filename=latest.name if latest else None,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")


@router.get("/backups", summary="List database backups")
def list_backups(admin: AuthedUser_MW) -> list[BackupItem]:
    settings = get_settings()
    backups = sorted(settings.database.backup_path.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        BackupItem(
            filename=p.name,
            size_bytes=p.stat().st_size,
            created_at=datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        )
        for p in backups
    ]


# ── Queue ─────────────────────────────────────────────────────────────────

@router.get("/queue", summary="List queue entries")
def list_queue(
    admin: AuthedUser_MW,
    queue_repo: QueueRepoDep,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    queue_status: str | None = Query(None, alias="status"),
) -> QueueList:
    qs = None
    if queue_status:
        try:
            qs = QueueStatus(queue_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {queue_status}")
    rows, total = queue_repo.list_with_titles(page=page, per_page=per_page, status=qs)
    items = [
        QueueItem(
            id=mq.id, tmdb_id=mq.tmdb_id, title=title, status=str(mq.status),
            retries=mq.retries, message=mq.message, created_at=mq.created_at, updated_at=mq.updated_at,
        )
        for mq, title in rows
    ]
    return QueueList(items=items, total=total, page=page, per_page=per_page)


@router.post("/queue/refresh", summary="Refresh queue items")
def refresh_queue(body: QueueRefreshRequest, admin: AuthedUser_MW, queue_repo: QueueRepoDep, session: DbSession) -> QueueRefreshResponse:
    try:
        target_status = QueueStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    count = queue_repo.bulk_update_status(target_status, message=body.message, movie_ids=body.movie_ids)
    session.commit()
    return QueueRefreshResponse(detail=f"Updated {count} queue entries to '{body.status}'")


@router.post("/queue/retry-failed", summary="Retry all failed queue items")
def retry_failed_queue(admin: AuthedUser_MW, queue_repo: QueueRepoDep, session: DbSession) -> QueueRefreshResponse:
    count = queue_repo.retry_failed()
    session.commit()
    return QueueRefreshResponse(detail=f"Retried {count} failed queue entries")


# ── System ────────────────────────────────────────────────────────────────

@router.get("/stats", summary="Get system statistics")
def get_stats(admin: AuthedUser_MW, movie_repo: MovieRepoDep, user_repo: UserRepoDep, queue_repo: QueueRepoDep) -> SystemStats:
    settings = get_settings()
    total_movies = movie_repo.count()
    total_users = user_repo.count()
    active_users = user_repo.count_active()
    queue_by_status = queue_repo.count_by_status()
    return SystemStats(
        total_movies=total_movies,
        total_users=total_users,
        active_users=active_users,
        disabled_users=total_users - active_users,
        total_queue=sum(queue_by_status.values()),
        queue_by_status=queue_by_status,
        total_backups=len(list(settings.database.backup_path.glob("*.db"))),
    )


@router.get("/system-info", summary="Get detailed system information")
def get_system_info(admin: AuthedUser_MW) -> SystemInfo:
    from backend.infrastructure.scheduler import background_scheduler

    settings = get_settings()
    db_size = 0
    try:
        db_size = settings.database.database_file.stat().st_size
    except OSError:
        pass

    vector_store_size = _get_dir_size(str(settings.embedding.vector_store_path))
    log_file_size = 0
    try:
        log_file_size = settings.logging.log_file.stat().st_size
    except OSError:
        pass

    return SystemInfo(
        python_version=sys.version,
        app_name=settings.app_name,
        environment=settings.environment,
        db_size_bytes=db_size,
        vector_store_size_bytes=vector_store_size,
        log_file_size_bytes=log_file_size,
        uptime_seconds=time.monotonic() - _start_time,
        scheduler_running=background_scheduler.running,
    )


@router.get("/scheduler", summary="Get scheduler jobs")
def get_scheduler_jobs(admin: AuthedUser_MW) -> list[SchedulerJobItem]:
    from backend.infrastructure.scheduler import background_scheduler
    return [
        SchedulerJobItem(
            job_id=job.id, name=job.name,
            next_run_time=job.next_run_time.isoformat() if job.next_run_time else None,
            trigger=str(job.trigger),
        )
        for job in background_scheduler.get_jobs()
    ]


@router.post("/scheduler/{job_id}/trigger", summary="Trigger a scheduled job immediately")
def trigger_job(job_id: str, admin: AuthedUser_MW) -> DetailResponse:
    from backend.infrastructure.scheduler import background_scheduler

    job = background_scheduler.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    job.modify(next_run_time=datetime.now(timezone.utc))
    return DetailResponse(detail=f"Job '{job_id}' triggered for immediate execution")


@router.post("/scheduler/pause", summary="Pause the scheduler")
def pause_scheduler(admin: AuthedUser_MW) -> DetailResponse:
    from backend.infrastructure.scheduler import background_scheduler

    if not background_scheduler.running:
        raise HTTPException(status_code=400, detail="Scheduler is not running")
    background_scheduler.pause()
    return DetailResponse(detail="Scheduler paused")


@router.post("/scheduler/resume", summary="Resume the scheduler")
def resume_scheduler(admin: AuthedUser_MW) -> DetailResponse:
    from backend.infrastructure.scheduler import background_scheduler

    if not background_scheduler.running:
        raise HTTPException(status_code=400, detail="Scheduler is not running")
    background_scheduler.resume()
    return DetailResponse(detail="Scheduler resumed")


# ── Settings ──────────────────────────────────────────────────────────────

def _mask_key(key: str) -> str:
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


def _validate_tmdb_key(api_key: str) -> bool:
    import requests as http_requests
    try:
        resp = http_requests.get(
            "https://api.themoviedb.org/3/movie/550",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception:
        return False


def _update_env_file(key: str, value: str) -> None:
    from pathlib import Path
    env_path = Path(".env")
    if not env_path.exists():
        env_path.write_text(f"{key}={value}\n", encoding="utf-8")
        return

    lines = env_path.read_text(encoding="utf-8").splitlines(keepends=True)
    found = False
    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        if new_lines and not new_lines[-1].endswith("\n"):
            new_lines.append("\n")
        new_lines.append(f"{key}={value}\n")
    env_path.write_text("".join(new_lines), encoding="utf-8")


@router.get("/tmdb-key", summary="Get current TMDB API key status")
def get_tmdb_key(admin: AuthedUser_MW) -> TmdbKeyResponse:
    settings = get_settings()
    key = settings.tmdb.tmdb_api_key
    is_placeholder = key in ("placeholder-tmdb-key", "your-tmdb-api-key", "")
    return TmdbKeyResponse(
        masked_key=_mask_key(key) if key else "",
        is_placeholder=is_placeholder,
    )


@router.put("/tmdb-key", summary="Update TMDB API key")
def update_tmdb_key(body: UpdateTmdbKeyRequest, admin: AuthedUser_MW, request: Request) -> TmdbKeyResponse:
    new_key = body.api_key.strip()
    if not new_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")

    valid = _validate_tmdb_key(new_key)
    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Invalid TMDB API key. The key was tested against the TMDB API and failed. "
                   "Make sure you are using the API Read Access Token (v4 auth), not the API Key (v3 auth).",
        )

    _update_env_file("TMDB_API_KEY", new_key)

    from backend.infrastructure.external.tmdb_client import TMDBClient
    request.app.state.tmdb_client = TMDBClient(new_key, get_settings().tmdb.tmdb_base_url)

    get_settings.cache_clear()

    return TmdbKeyResponse(
        masked_key=_mask_key(new_key),
        is_placeholder=False,
        is_valid=True,
    )


@router.post("/tmdb-key/validate", summary="Validate a TMDB API key without saving")
def validate_tmdb_key(body: UpdateTmdbKeyRequest, admin: AuthedUser_MW) -> TmdbKeyResponse:
    new_key = body.api_key.strip()
    if not new_key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    valid = _validate_tmdb_key(new_key)
    return TmdbKeyResponse(
        masked_key=_mask_key(new_key),
        is_placeholder=False,
        is_valid=valid,
    )


@router.get("/logs", summary="Get recent application logs")
def get_logs(
    admin: AuthedUser_MW,
    lines: int = Query(100, ge=1, le=1000, description="Number of lines to return"),
) -> LogsResponse:
    settings = get_settings()
    log_file = settings.logging.log_file
    if not log_file.exists():
        return LogsResponse(lines=[], total_lines=0, log_file=str(log_file))

    try:
        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
            all_lines = deque(f, maxlen=lines)
        return LogsResponse(
            lines=[line.rstrip("\n") for line in all_lines],
            total_lines=len(all_lines),
            log_file=str(log_file),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")
