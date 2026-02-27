# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Movie Recommendation API built with FastAPI + SQLite + ChromaDB. Single Python application (not a monorepo). All services (DB, vector store, scheduler) are embedded in-process.

### Package management

This project uses **uv** with a `uv.lock` lockfile. Python 3.12 is specified in `.python-version`.

- Install all deps: `uv sync --group test --group prod`
- Test-only deps: `uv sync --group test`
- Run commands via: `uv run <command>`

### Running the application

```
uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

A `.env` file is required in the project root with: `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_DAYS`, `TMDB_API_KEY`, `LOGLEVEL`, `USE_CUDA`. See `README.md` for details. The app loads `.env` automatically via `python-dotenv`.

The `TMDB_API_KEY` can be a placeholder for local development; only background TMDB fetch jobs will fail without a real key. The API itself (auth, movie queries on existing data) works fine.

### Running tests

```
uv run pytest
```

Tests use in-memory SQLite and mock all external APIs (TMDB, scheduler). No `.env` file or external services are needed for tests. Coverage config is in `pytest.ini`.

### Linting

No linter is configured in the project. `ruff check .` can be used but will report pre-existing warnings.

### Key gotchas

- The `sentence-transformers` model (`nomic-ai/nomic-embed-text-v1.5`) is only downloaded on first use in the vector store. This is a large download (~500MB+). For dev/test, set `USE_CUDA=false` in `.env`.
- SQLite database is at `data/db/movies.db` and is created automatically on first app startup via `init_db()`.
- The ChromaDB vector store persists at `data/vector_store/`. Both directories are auto-created.
- APScheduler background jobs start on app startup. They may log warnings/errors if `TMDB_API_KEY` is invalid — this is normal for local dev without a real TMDB key.
