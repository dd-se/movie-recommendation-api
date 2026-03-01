from collections.abc import Callable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..core.logging import get_logger

logger = get_logger(__name__)
background_scheduler = BackgroundScheduler()


def start_scheduler() -> None:
    background_scheduler.start()


def shutdown_scheduler() -> None:
    background_scheduler.shutdown()


def add_job(job_id: str, trigger: CronTrigger, callback: Callable[..., None], *args) -> None:
    background_scheduler.add_job(callback, trigger=trigger, id=job_id, args=args, replace_existing=True)
    logger.info(f"Scheduled '{callback.__name__}' with job ID '{job_id}'")
