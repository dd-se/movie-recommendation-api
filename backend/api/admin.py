import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update

from ..scheduler import background_scheduler
from ..storage.db import (
    BACKUP_PATH,
    ApiSession,
    Movie,
    MovieQueue,
    MovieRecommendation,
    QueueStatus,
    User,
    backup_db,
)
from ..validation import (
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
from .auth import AuthedUser_MW
from .exceptions import NOT_FOUND

admin_router = APIRouter(prefix="/admin", tags=["admin"])

VALID_SCOPES = {"movie:read", "movie:write"}


# ── Sync ──────────────────────────────────────────────────────────────────

@admin_router.get("/sync", summary="Sync Movie and MovieQueue tables", status_code=status.HTTP_200_OK)
async def sync_movie_and_movie_queue_tables(admin: AuthedUser_MW, db: ApiSession):
    """Ensures every movie has a corresponding MovieQueue entry."""
    movies = (
        db.execute(
            select(Movie)
            .outerjoin(MovieQueue, Movie.tmdb_id == MovieQueue.tmdb_id)
            .where(MovieQueue.tmdb_id == None)
        )
        .scalars()
        .all()
    )
    if not movies:
        raise NOT_FOUND

    recreated_count = 0
    for movie in movies:
        db.add(MovieQueue(tmdb_id=movie.tmdb_id))
        recreated_count += 1

    db.commit()
    return {"detail": f"Recreated '{recreated_count}' missing MovieQueue entries."}


# ── Users ─────────────────────────────────────────────────────────────────

@admin_router.get("/users", response_model=AdminUserList, summary="List all users")
async def list_users(
    admin: AuthedUser_MW,
    db: ApiSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Filter by email"),
):
    q = select(User)
    count_q = select(func.count(User.id))

    if search:
        q = q.where(User.email.icontains(search))
        count_q = count_q.where(User.email.icontains(search))

    total = db.execute(count_q).scalar() or 0
    users = db.execute(q.order_by(User.id).offset((page - 1) * per_page).limit(per_page)).scalars().all()

    return AdminUserList(
        users=[AdminUserItem(id=u.id, email=u.email, disabled=u.disabled, scopes=u.scopes) for u in users],
        total=total,
        page=page,
        per_page=per_page,
    )


@admin_router.patch("/users/{user_id}/scopes", summary="Update user scopes")
async def update_user_scopes(user_id: int, body: UpdateScopesRequest, admin: AuthedUser_MW, db: ApiSession):
    for scope in body.scopes:
        if scope not in VALID_SCOPES:
            raise HTTPException(status_code=400, detail=f"Invalid scope: {scope}")
    if not body.scopes:
        raise HTTPException(status_code=400, detail="At least one scope is required")

    user = db.execute(select(User).where(User.id == user_id)).scalar()
    if not user:
        raise NOT_FOUND

    user.scopes = " ".join(body.scopes)
    db.commit()
    return {"detail": f"Scopes updated for {user.email}", "scopes": user.scopes}


@admin_router.patch("/users/{user_id}/status", summary="Enable or disable a user")
async def update_user_status(user_id: int, body: UpdateStatusRequest, admin: AuthedUser_MW, db: ApiSession):
    user = db.execute(select(User).where(User.id == user_id)).scalar()
    if not user:
        raise NOT_FOUND

    if user.email == admin.email:
        raise HTTPException(status_code=400, detail="Cannot change your own status")

    user.disabled = body.disabled
    db.commit()
    status_text = "disabled" if body.disabled else "enabled"
    return {"detail": f"User {user.email} has been {status_text}"}


# ── Database ──────────────────────────────────────────────────────────────

@admin_router.post("/backup", summary="Create a database backup")
async def create_backup(admin: AuthedUser_MW):
    try:
        backup_db()
        backups = sorted(BACKUP_PATH.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
        latest = backups[0] if backups else None
        return {
            "detail": "Backup created successfully",
            "filename": latest.name if latest else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@admin_router.get("/backups", response_model=list[BackupItem], summary="List database backups")
async def list_backups(admin: AuthedUser_MW):
    backups = sorted(BACKUP_PATH.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        BackupItem(
            filename=p.name,
            size_bytes=p.stat().st_size,
            created_at=datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc).isoformat(),
        )
        for p in backups
    ]


# ── Queue ─────────────────────────────────────────────────────────────────

@admin_router.get("/queue", response_model=QueueList, summary="List queue entries")
async def list_queue(
    admin: AuthedUser_MW,
    db: ApiSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    queue_status: str | None = Query(None, alias="status", description="Filter by queue status"),
):
    q = select(MovieQueue, Movie.title).outerjoin(Movie, MovieQueue.tmdb_id == Movie.tmdb_id)
    count_q = select(func.count(MovieQueue.id))

    if queue_status:
        try:
            qs = QueueStatus(queue_status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {queue_status}")
        q = q.where(MovieQueue.status == qs)
        count_q = count_q.where(MovieQueue.status == qs)

    total = db.execute(count_q).scalar() or 0
    rows = db.execute(
        q.order_by(MovieQueue.updated_at.desc().nullslast(), MovieQueue.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).all()

    items = [
        QueueItem(
            id=mq.id,
            tmdb_id=mq.tmdb_id,
            title=title,
            status=str(mq.status),
            retries=mq.retries,
            message=mq.message,
            created_at=mq.created_at,
            updated_at=mq.updated_at,
        )
        for mq, title in rows
    ]
    return QueueList(items=items, total=total, page=page, per_page=per_page)


@admin_router.post("/queue/refresh", summary="Refresh queue items")
async def refresh_queue(body: QueueRefreshRequest, admin: AuthedUser_MW, db: ApiSession):
    try:
        target_status = QueueStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    q = update(MovieQueue)
    if body.movie_ids:
        q = q.where(MovieQueue.tmdb_id.in_(body.movie_ids))

    q = q.values(
        status=target_status,
        message=body.message,
        retries=0,
        updated_at=datetime.now(timezone.utc),
    )
    result = db.execute(q)
    db.commit()
    return {"detail": f"Updated {result.rowcount} queue entries to '{body.status}'"}


# ── System ────────────────────────────────────────────────────────────────

@admin_router.get("/stats", response_model=SystemStats, summary="Get system statistics")
async def get_stats(admin: AuthedUser_MW, db: ApiSession):
    total_movies = db.execute(select(func.count(Movie.id))).scalar() or 0
    total_users = db.execute(select(func.count(User.id))).scalar() or 0
    active_users = db.execute(select(func.count(User.id)).where(User.disabled == False)).scalar() or 0
    disabled_users = total_users - active_users

    queue_rows = db.execute(
        select(MovieQueue.status, func.count(MovieQueue.id)).group_by(MovieQueue.status)
    ).all()
    queue_by_status = {str(s): c for s, c in queue_rows}
    total_queue = sum(queue_by_status.values())

    backups = list(BACKUP_PATH.glob("*.db"))

    return SystemStats(
        total_movies=total_movies,
        total_users=total_users,
        active_users=active_users,
        disabled_users=disabled_users,
        total_queue=total_queue,
        queue_by_status=queue_by_status,
        total_backups=len(backups),
    )


@admin_router.get("/scheduler", response_model=list[SchedulerJobItem], summary="Get scheduler jobs")
async def get_scheduler_jobs(admin: AuthedUser_MW):
    jobs = background_scheduler.get_jobs()
    return [
        SchedulerJobItem(
            job_id=job.id,
            name=job.name,
            next_run_time=job.next_run_time.isoformat() if job.next_run_time else None,
            trigger=str(job.trigger),
        )
        for job in jobs
    ]
