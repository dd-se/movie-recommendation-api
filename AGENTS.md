# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This repo has two services:

| Service | Stack | Location | Dev Server |
|---|---|---|---|
| **Backend API** | FastAPI + SQLite + ChromaDB | `/` (root) | `uv run uvicorn backend.api.main:app --reload` → `:8000` |
| **Frontend** | React + TypeScript + Vite + Tailwind CSS | `frontend/` | `npm run dev` → `:5173` (proxies API to `:8000`) |

See `README.md` for full backend details and `frontend/package.json` for frontend scripts.

### Running the backend

```bash
uv run uvicorn backend.api.main:app --reload
```

- Legacy request builder: `http://127.0.0.1:8000`
- OpenAPI docs: `http://127.0.0.1:8000/docs`
- Health check: `GET /api/health`
- A `.env` file is required in the project root (see `README.md`). For dev/test, `TMDB_API_KEY` can be a placeholder.

### Running the frontend

```bash
cd frontend && npm run dev
```

- Dev server: `http://localhost:5173`
- The Vite config (`frontend/vite.config.ts`) proxies `/auth`, `/v1`, `/v2`, `/admin`, `/api` to the backend at `:8000`.
- **Start the backend first**, then the frontend.

### Running tests

- **Backend:** `uv run pytest` — fully self-contained (in-memory SQLite, mocked TMDB, mocked scheduler)
- **Frontend:** `cd frontend && npm run lint && npx tsc -b --noEmit && npm run build`

### Linting

- **Backend:** No linter configured (no ruff/flake8/mypy/pyright)
- **Frontend:** ESLint via `npm run lint` in `frontend/`

### Key caveats

- `data/db/`, `data/vector_store/`, and `logs/` directories must exist before starting the backend. Create with `mkdir -p data/db data/vector_store logs`.
- APScheduler jobs auto-start on backend startup. They fail silently if `TMDB_API_KEY` is invalid — fine for local dev.
- `uv` is the backend package manager (lockfile: `uv.lock`). Use `uv sync --group prod --group test` for full dev setup.
- Python version pinned to 3.12 in `.python-version`.
- The frontend uses Tailwind CSS v4 (`@tailwindcss/vite` plugin) — no `tailwind.config.js` needed.
- Semantic search (description-based filters) requires the vector store to be populated. Without data, the backend returns 500 for description queries. The frontend handles this gracefully with a "Request failed" message.
- The `.env` file needs `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_DAYS`, `TMDB_API_KEY`, `LOGLEVEL`, `USE_CUDA`. See `README.md`.
