from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import CORS_ORIGINS
from .core.database import init_db
from .core.logging import get_logger
from .routers import all_routers
from .scheduler import add_job, shutdown_scheduler, start_scheduler
from .scheduler.jobs import JOBS
from .schemas.common import HealthResponse

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    for job in JOBS:
        add_job(*job)
    logger.warning("API server started")
    yield
    shutdown_scheduler()
    logger.warning("API server stopped")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


for router in all_routers:
    app.include_router(router)

app.mount("/", StaticFiles(directory=Path(__file__).parent / "static" / "html", html=True), name="Request Builder")
