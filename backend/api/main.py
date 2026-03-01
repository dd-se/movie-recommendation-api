import os

from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok"}


for router in [admin_router, auth_router, v1_router, v2_router]:
    app.include_router(router)
app.mount("/", StaticFiles(directory=Path(__file__).parent / "html", html=True), name="Request Builder")
