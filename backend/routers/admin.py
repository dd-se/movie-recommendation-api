from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update

from ..core.database import ApiSession
from ..core.exceptions import NOT_FOUND
from ..core.security import AuthedUser_MW
from ..models import Movie, MovieQueue, QueueStatus, User
from ..schemas.admin import (
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
from ..schemas.common import BackupResponse, DetailResponse, QueueRefreshResponse, ScopeUpdateResponse
from ..services.backup import BACKUP_PATH, backup_db

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_SCOPES = {"movie:read", "movie:write"}


# ── Sync ──────────────────────────────────────────────────────────────────

@router.get("/sync", summary="Sync Movie and MovieQueue tables", status_code=status.HTTP_200_OK)
def sync_tables(admin: AuthedUser_MW, db: ApiSession) -> DetailResponse:
    movies = db.execute(
        select(Movie).outerjoin(MovieQueue, Movie.tmdb_id == MovieQueue.tmdb_id).where(MovieQueue.tmdb_id == None)
    ).scalars().all()
    if not movies:
        raise NOT_FOUND
    for movie in movies:
        db.add(MovieQueue(tmdb_id=movie.tmdb_id))
    db.commit()
    return DetailResponse(detail=f"Recreated '{len(movies)}' missing MovieQueue entries.")


# ── Users ─────────────────────────────────────────────────────────────────

@router.get("/users", summary="List all users")
def list_users(
    admin: AuthedUser_MW, db: ApiSession,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Filter by email"),
) -> AdminUserList:
    q = select(User)
    count_q = select(func.count(User.id))
    if search:
        q = q.where(User.email.icontains(search))
        count_q = count_q.where(User.email.icontains(search))
    total: int = db.execute(count_q).scalar() or 0
    users = db.execute(q.order_by(User.id).offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return AdminUserList(users=[AdminUserItem.model_validate(u) for u in users], total=total, page=page, per_page=per_page)


@router.patch("/users/{user_id}/scopes", summary="Update user scopes")
def update_user_scopes(user_id: int, body: UpdateScopesRequest, admin: AuthedUser_MW, db: ApiSession) -> ScopeUpdateResponse:
    if invalid := [s for s in body.scopes if s not in VALID_SCOPES]:
        raise HTTPException(status_code=400, detail=f"Invalid scope(s): {', '.join(invalid)}")
    if not body.scopes:
        raise HTTPException(status_code=400, detail="At least one scope is required")
    user = db.execute(select(User).where(User.id == user_id)).scalar()
    if not user:
        raise NOT_FOUND
    user.scopes = " ".join(body.scopes)
    db.commit()
    return ScopeUpdateResponse(detail=f"Scopes updated for {user.email}", scopes=user.scopes)


@router.patch("/users/{user_id}/status", summary="Enable or disable a user")
def update_user_status(user_id: int, body: UpdateStatusRequest, admin: AuthedUser_MW, db: ApiSession) -> DetailResponse:
    user = db.execute(select(User).where(User.id == user_id)).scalar()
    if not user:
        raise NOT_FOUND
    if user.email == admin.email:
        raise HTTPException(status_code=400, detail="Cannot change your own status")
    user.disabled = body.disabled
    db.commit()
    return DetailResponse(detail=f"User {user.email} has been {'disabled' if body.disabled else 'enabled'}")


# ── Database ──────────────────────────────────────────────────────────────

@router.post("/backup", summary="Create a database backup")
def create_backup(admin: AuthedUser_MW) -> BackupResponse:
    try:
        backup_db()
        backups = sorted(BACKUP_PATH.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
        latest = backups[0] if backups else None
        return BackupResponse(detail="Backup created successfully", filename=latest.name if latest else None, timestamp=datetime.now(timezone.utc).isoformat())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")


@router.get("/backups", summary="List database backups")
def list_backups(admin: AuthedUser_MW) -> list[BackupItem]:
    backups = sorted(BACKUP_PATH.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        BackupItem(filename=p.name, size_bytes=p.stat().st_size, created_at=datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat())
        for p in backups
    ]


# ── Queue ─────────────────────────────────────────────────────────────────

@router.get("/queue", summary="List queue entries")
def list_queue(
    admin: AuthedUser_MW, db: ApiSession,
    page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100),
    queue_status: str | None = Query(None, alias="status"),
) -> QueueList:
    q = select(MovieQueue, Movie.title).outerjoin(Movie, MovieQueue.tmdb_id == Movie.tmdb_id)
    count_q = select(func.count(MovieQueue.id))
    if queue_status:
        try:
            qs = QueueStatus(queue_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {queue_status}")
        q = q.where(MovieQueue.status == qs)
        count_q = count_q.where(MovieQueue.status == qs)
    total: int = db.execute(count_q).scalar() or 0
    rows = db.execute(q.order_by(MovieQueue.updated_at.desc().nullslast(), MovieQueue.id.desc()).offset((page - 1) * per_page).limit(per_page)).all()
    items = [QueueItem(id=mq.id, tmdb_id=mq.tmdb_id, title=title, status=str(mq.status), retries=mq.retries, message=mq.message, created_at=mq.created_at, updated_at=mq.updated_at) for mq, title in rows]
    return QueueList(items=items, total=total, page=page, per_page=per_page)


@router.post("/queue/refresh", summary="Refresh queue items")
def refresh_queue(body: QueueRefreshRequest, admin: AuthedUser_MW, db: ApiSession) -> QueueRefreshResponse:
    try:
        target_status = QueueStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    q = update(MovieQueue)
    if body.movie_ids:
        q = q.where(MovieQueue.tmdb_id.in_(body.movie_ids))
    q = q.values(status=target_status, message=body.message, retries=0, updated_at=datetime.now(timezone.utc))
    result = db.execute(q)
    db.commit()
    return QueueRefreshResponse(detail=f"Updated {result.rowcount} queue entries to '{body.status}'")


# ── System ────────────────────────────────────────────────────────────────

@router.get("/stats", summary="Get system statistics")
def get_stats(admin: AuthedUser_MW, db: ApiSession) -> SystemStats:
    total_movies: int = db.execute(select(func.count(Movie.id))).scalar() or 0
    total_users: int = db.execute(select(func.count(User.id))).scalar() or 0
    active_users: int = db.execute(select(func.count(User.id)).where(User.disabled == False)).scalar() or 0
    queue_rows = db.execute(select(MovieQueue.status, func.count(MovieQueue.id)).group_by(MovieQueue.status)).all()
    queue_by_status: dict[str, int] = {str(s): c for s, c in queue_rows}
    return SystemStats(
        total_movies=total_movies, total_users=total_users, active_users=active_users,
        disabled_users=total_users - active_users, total_queue=sum(queue_by_status.values()),
        queue_by_status=queue_by_status, total_backups=len(list(BACKUP_PATH.glob("*.db"))),
    )


@router.get("/scheduler", summary="Get scheduler jobs")
def get_scheduler_jobs(admin: AuthedUser_MW) -> list[SchedulerJobItem]:
    from ..scheduler import background_scheduler
    return [
        SchedulerJobItem(job_id=job.id, name=job.name, next_run_time=job.next_run_time.isoformat() if job.next_run_time else None, trigger=str(job.trigger))
        for job in background_scheduler.get_jobs()
    ]
