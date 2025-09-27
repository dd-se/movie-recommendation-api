<p align="center">
  <img src="src/api/html/img/logo.svg" alt="The Movie Database Logo" width="512">
</p>
<p align="center"><em>Find the right movie, instantly.</em></p>

## About

A FastAPI-based API for discovering and recommending movies. It integrates with The Movie Database (TMDB) to fetch movie data, uses vector embeddings for semantic search and includes user authentication, recommendation tracking, and scheduled background jobs for data processing.

## Features

- **User Authentication**: Secure signup, login, and JWT-based access control with scopes (e.g., `movie:read`, `movie:write`).
- **Movie Recommendations**: Get recommendations based on filters like description, genres, ratings, and more.
- **Semantic Search**: Uses vector embeddings to find movies similar to a user-provided description.
- **TMDB Integration**: Fetches movie data (now playing, top-rated, popular) from TMDB and stores it in a SQLite database.
- **Background Scheduling**: APScheduler jobs to periodically fetch new movies from TMDB, refresh existing data, preprocess descriptions, and update the vector store.
- **Database Management**: SQLite backend with SQLAlchemy ORM for storing users, movies, recommendations, and processing queues.
- **Request Builder**: Easily test API endpoints directly in your browser at `http://127.0.0.1:8000`.

## Stack

- **Framework**: FastAPI
- **Database**: SQLite with SQLAlchemy
- **Authentication**: JWT (PyJWT) with bcrypt for password hashing
- **Semantic Search**: ChromaDB with Sentence Transformers (`nomic-ai/nomic-embed-text-v1.5`)
- **Scheduling**: APScheduler
- **External API**: TMDB for movie data

## Installation
- Python 3.11+
- Install dependencies with pip or uv:
    ```bash
    pip install -r requirements.txt
    ```
    ```bash
    # For running the application
    uv sync --group prod
    ```
    ```bash
    # If planning on only running the tests
    uv sync --group test
    ```

- **Configure Environment Variables**:
   Create a `.env` file in the root directory with the following:
   ```
   SECRET_KEY=your-secret-key  # For JWT signing
   ACCESS_TOKEN_EXPIRE_DAYS=30  # Token expiration in days
   TMDB_API_KEY=your-tmdb-api-key  # From https://www.themoviedb.org/
   LOGLEVEL=INFO  # DEBUG, INFO, WARNING, etc.
   USE_CUDA=false  # Set to 'true' if CUDA (NVIDIA) is available for embeddings
   ```
   Note: The app loads `.env` automatically via `dotenv`.

  ### Populate the database with `app_ctl.py` (Optional)
    - Populates the database with movie data from TMDB's daily ID exports. Read below on how to.

## Usage

- Run the FastAPI server using Uvicorn:
    ```bash
    uvicorn src.api.main:app [--reload]
    ```

    The movie request builder will be available at `http://127.0.0.1:8000`, served via static files from `src/api/html/`.

    The documentation endpoint will be available at  `http://127.0.0.1:8000/docs`.

### Filtering Movies

- `title`: Partial title match.
- `description`: Semantic search query (e.g., "A computer hacker...").
- `release_date_from` / `release_date_to`: Date range.
- `runtime_min` / `runtime_max`: Runtime in minutes.
- `vote_average_min` / `popularity_min`: Read more about it [here](https://developer.themoviedb.org/docs/popularity-and-trending).
- Lists: `cast`, `genres`, `production_countries`, `keywords`, `spoken_languages`

  Note: At least one filter must be provided to search for movies.

## Background Jobs

Jobs run via APScheduler (started on app startup):
- Fetch new movies from TMDB (now playing, top_rated, popular) every few hours.
- Refresh movie data (every 5-10 minutes).
- Preprocess descriptions (every 30 minutes).
- Add metadata and embeddings to vector store (every 30 minutes).

## Data

- **Populate Database**: Stored at `data/populate_db/`.
- **Database**: Stored at `data/db/movies.db`. Backups in `data/db/backups/`.
- **Vector Store**: Stored at `data/vector_store/`.
- **Logs** are written to `logs/logs.txt` and console.

## Command-Line Tool
The app includes a command-line interface (`app_ctl.py`) for administrative tasks, built with argparse. It allows you to:
- Populate DB with TMDB Daily ID Export:
    ```bash
    python app_ctl.py populate-db --url URL | --resume
    ```
    Use --url to specify an export URL (see [Daily ID Export](https://developer.themoviedb.org/docs/daily-id-exports)) or --resume to continue with the last processed export.

    Stop anytime with Ctrl + C. To pick up where you left off, restart using --resume.

- Backup the Database:
    ```bash
    python app_ctl.py backup
    ```
    Creates a timestamped SQLite database backup in data/db/backups/.

- Manage User Accounts:
   - Change user scopes
      ```bash
      python app_ctl.py user scopes user@example.com movie:read movie:write ..
      ```
      New users default to `movie:read`.

    - Disable user
      ```bash
      python app_ctl.py user status user@example.com true|false
      ```
- Update movie queue status:
  ```bash
  python app_ctl.py queue refresh_data [--message "Your message here"] [12345 67890]
  ```
Type `--help` for more information.


## Queue Status
The QueueStatus enum, defined in src/storage/db.py, represents the states of movie processing tasks in the MovieQueue table. It is used to manage the lifecycle of movie data updates and embeddings in the Movie Recommendation API. The enum values are:

  - **REFRESH_DATA**: Indicates a movie's data needs to be refreshed from TMDB.

  - **PREPROCESS_DESCRIPTION**: Marks a movie for description preprocessing.

  - **CREATE_EMBEDDING**: Signals that a preprocessed description is ready for vector embedding generation and storage in ChromaDB.

  - **COMPLETED**: The movie's data processing (refresh, preprocessing, and embedding) is finished.

  - **FAILED**: Processing failed after retries (max 3), with an error message stored in the queue.

## Acknowledgments

- TMDB for movie data.
- FastAPI, SQLAlchemy, ChromaDB etc.

## License

MIT
