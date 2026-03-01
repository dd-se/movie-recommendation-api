from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from backend.api.deps import AuthedUser_MW, DbSession, MovieRepoDep, QueueRepoDep, UserRepoDep
from backend.api.schemas.admin import (
    AdminUserItem,
    AdminUserList,
    BackupItem,
    QueueItem,
    QueueList,
    QueueRefreshRequest,
    SchedulerJobItem,
    SystemStats,
    UpdateScopesRequest,
    UpdateStatusRequest,
)
from backend.api.schemas.common import BackupResponse, DetailResponse, QueueRefreshResponse, ScopeUpdateResponse
from backend.core.settings import get_settings
from backend.domain.errors import NotFoundError
from backend.infrastructure.backup.backup_service import backup_db
from backend.infrastructure.db.models import MovieQueue, QueueStatus

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_SCOPES = {"movie:read", "movie:write"}


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
