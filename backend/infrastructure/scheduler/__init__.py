from collections.abc import Callable
from typing import Any

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session, sessionmaker

from backend.core.logging import get_logger
from backend.core.settings import Settings
from backend.infrastructure.external.tmdb_client import TMDBClient
from backend.infrastructure.vector.chroma_store import ChromaVectorStore

logger = get_logger(__name__)
background_scheduler = BackgroundScheduler()


def start_scheduler() -> None:
    background_scheduler.start()


def shutdown_scheduler() -> None:
    background_scheduler.shutdown()


def add_job(job_id: str, trigger: CronTrigger, callback: Callable[..., None], *args: Any) -> None:
    background_scheduler.add_job(callback, trigger=trigger, id=job_id, args=args, replace_existing=True)
    logger.info(f"Scheduled '{callback.__name__}' with job ID '{job_id}'")


def setup_jobs(
    session_factory: sessionmaker[Session],
    tmdb_client: TMDBClient,
    vector_store: ChromaVectorStore,
    settings: Settings,
) -> None:
    from .jobs import get_jobs

    jobs = get_jobs(session_factory, tmdb_client, vector_store, settings)
    for job in jobs:
        add_job(*job)
