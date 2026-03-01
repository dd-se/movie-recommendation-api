from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.error_handlers import register_error_handlers
from .api.routers import all_routers
from .api.schemas.common import HealthResponse
from .core.logging import get_logger
from .core.settings import get_settings
from .infrastructure.db.base import Base
from .infrastructure.db.session import create_db_engine, create_session_factory
from .infrastructure.external.tmdb_client import TMDBClient
from .infrastructure.scheduler import setup_jobs, shutdown_scheduler, start_scheduler
from .infrastructure.vector.chroma_store import ChromaVectorStore

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    engine = create_db_engine(settings.database.database_url)
    session_factory = create_session_factory(engine)
    Base.metadata.create_all(bind=engine)
    app.state.engine = engine
    app.state.session_factory = session_factory

    app.state.tmdb_client = TMDBClient(
        settings.tmdb.tmdb_api_key, settings.tmdb.tmdb_base_url,
    )

    vector_store = ChromaVectorStore(
        str(settings.embedding.vector_store_path),
        settings.embedding.embedding_model,
        settings.embedding.use_cuda,
    )
    app.state.vector_store = vector_store

    start_scheduler()
    setup_jobs(session_factory, app.state.tmdb_client, vector_store, settings)

    logger.warning("API server started")
    yield
    shutdown_scheduler()
    logger.warning("API server stopped")


app = FastAPI(lifespan=lifespan)


def get_cors_origins() -> list[str]:
    settings = get_settings()
    return settings.security.cors_origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)


@app.get("/api/health", tags=["health"])
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


for router in all_routers:
    app.include_router(router)

app.mount("/", StaticFiles(directory=Path(__file__).parent / "static" / "html", html=True), name="Request Builder")
