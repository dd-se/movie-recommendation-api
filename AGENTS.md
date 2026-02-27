# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **Movie Recommendation API** built with FastAPI. It uses SQLite (file-based), ChromaDB (embedded vector store), and integrates with TMDB for movie data. See `README.md` for full details.

### Running the application

```bash
uv run uvicorn src.api.main:app --reload
```

- The request builder UI is at `http://127.0.0.1:8000`
- The OpenAPI docs are at `http://127.0.0.1:8000/docs`
- A `.env` file is required in the project root (see `README.md` for variables). For dev/test, `TMDB_API_KEY` can be a placeholder since TMDB calls are mocked in tests.

### Running tests

```bash
uv run pytest
```

Tests are fully self-contained: they use in-memory SQLite, mock the TMDB API, and mock the scheduler. No external services or API keys needed.

### Linting

No linter (ruff, flake8, mypy, pyright) is configured in this project.

### Key caveats

- The `data/db/`, `data/vector_store/`, and `logs/` directories must exist before starting the server. Create them with `mkdir -p data/db data/vector_store logs`.
- The app auto-starts background APScheduler jobs on startup (TMDB fetch, data refresh, etc.). These will fail silently if `TMDB_API_KEY` is invalid, which is fine for local dev.
- `uv` is the preferred package manager (lockfile: `uv.lock`). Use `uv sync --group prod --group test` for full dev setup, or `uv sync --group test` for test-only.
- Python version is pinned to 3.12 in `.python-version`.
