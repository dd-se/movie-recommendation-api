from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from ..logger import get_logger
from ..scheduler import add_job, shutdown_scheduler, start_scheduler
from ..scheduler.jobs import JOBS
from ..storage.db import init_db
from .admin import admin_router
from .auth import auth_router
from .v1 import v1_router
from .v2 import v2_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # On startup do this
    init_db()
    start_scheduler()
    for job in JOBS:
        add_job(*job)
    logger.warning("API server started")
    yield
    # On shutdown do this
    shutdown_scheduler()
    logger.warning("API server stopped")


app = FastAPI(lifespan=lifespan)
for router in [admin_router, auth_router, v1_router, v2_router]:
    app.include_router(router)
app.mount("/", StaticFiles(directory=Path(__file__).parent / "html", html=True), name="Request Builder")
