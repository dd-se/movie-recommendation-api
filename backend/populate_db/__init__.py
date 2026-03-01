import gzip
import json
import shutil
import threading
from pathlib import Path
from time import sleep

import pandas as pd
import regex
import requests
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from ..core.logging import get_logger
from ..core.settings import get_settings
from ..infrastructure.db.base import Base
from ..infrastructure.db.models import Movie, MovieQueue
from ..infrastructure.db.session import create_db_engine, create_session_factory
from ..infrastructure.external.tmdb_client import TMDBClient
from ..infrastructure.scheduler.jobs import process_queue_descriptions, process_queue_add_to_vector_store
from ..infrastructure.vector.chroma_store import ChromaVectorStore

logger = get_logger(__name__)

LATIN_CHARS = regex.compile(r"[\p{Latin}0-9\s.,!?;:/\'\"()\-\[\]–—\u201c\u201d\u2018\u2019@]")


def get_populate_db_paths() -> dict[str, Path]:
    settings = get_settings()
    populate_db_path = settings.database.populate_db_path
    return {
        "daily_ids_export": populate_db_path / "tmdb_daily_ids_export.json",
        "filtered_daily_ids_export": populate_db_path / "tmdb_ids_filtered.csv",
        "state_file": populate_db_path / "resume_from_index.json",
    }


def download_and_extract_export_file(url: str) -> None:
    paths = get_populate_db_paths()
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with gzip.GzipFile(fileobj=r.raw) as f_in:
            with open(paths["daily_ids_export"], "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
    print(f"Extracted: {paths['daily_ids_export']}")


def is_mostly_latin(text: str, threshold: float = 0.9) -> bool:
    settings = get_settings()
    actual_threshold = threshold if threshold != 0.9 else settings.populate_db.latin_threshold
    text = text.strip()
    text_len = len(text)
    if text_len == 0:
        return False
    latin_count = len(LATIN_CHARS.findall(text))
    return (latin_count / text_len) >= actual_threshold


def save_state(idx: int) -> None:
    paths = get_populate_db_paths()
    with open(paths["state_file"], "w") as f:
        json.dump({"resume_from_index": idx}, f)
        logger.info(f"Resume index set to '{idx}'")


def load_state() -> int:
    paths = get_populate_db_paths()
    if not paths["state_file"].exists():
        return 0
    with open(paths["state_file"]) as f:
        return json.load(f).get("resume_from_index", 0)


def _create_session_and_deps() -> tuple[sessionmaker, TMDBClient, ChromaVectorStore]:
    settings = get_settings()
    engine = create_db_engine(settings.database.database_url)
    session_factory = create_session_factory(engine)
    Base.metadata.create_all(bind=engine)
    tmdb_client = TMDBClient(settings.tmdb.tmdb_api_key, settings.tmdb.tmdb_base_url)
    vector_store = ChromaVectorStore(
        str(settings.embedding.vector_store_path),
        settings.embedding.embedding_model,
        settings.embedding.use_cuda,
    )
    return session_factory, tmdb_client, vector_store


def finish_processing_in_background(
    stop_processing: threading.Event,
    session_factory: sessionmaker,
    vector_store: ChromaVectorStore,
) -> None:
    while not stop_processing.is_set():
        process_queue_descriptions(session_factory)
        process_queue_add_to_vector_store(session_factory, vector_store)
        sleep(10)


def process_movies(
    movies: pd.DataFrame,
    session_factory: sessionmaker,
    tmdb_client: TMDBClient,
    vector_store: ChromaVectorStore,
) -> None:
    from ..domain.policies import is_acceptable_movie
    settings = get_settings()
    start_idx = load_state()
    logger.info(f"Resuming from index '{start_idx}'")
    db = session_factory()
    stop_processing = threading.Event()
    threading.Thread(target=finish_processing_in_background, args=(stop_processing, session_factory, vector_store), daemon=True).start()
    try:
        current_ids = set(db.execute(select(Movie.tmdb_id)).scalars().all())
        added_counter = 0
        for idx, row in movies.iloc[start_idx:].iterrows():
            row_id = row.get("id")
            if row_id is None:
                continue
            try:
                if row_id in current_ids:
                    continue
                validated_movie = tmdb_client.fetch_movie_details(row_id)
                if not is_acceptable_movie(validated_movie.genres, validated_movie.spoken_languages):
                    continue
                movie = Movie(**validated_movie.model_dump())
                queue_entry = MovieQueue(tmdb_id=validated_movie.tmdb_id)
                db.add_all([movie, queue_entry])
                added_counter += 1
                if added_counter % settings.populate_db.commit_interval == 0:
                    db.commit()
                    save_state(idx + 1)
            except KeyboardInterrupt:
                db.commit()
                save_state(idx)
                logger.info("Interrupted by user. Run again to resume from saved state.")
                exit(1)
            except requests.RequestException as e:
                logger.error(f"Network error at row '{idx}', id={row_id}: {e}")
            except SQLAlchemyError as e:
                logger.critical(f"Database error: '{e}'")
                db.rollback()
                exit(1)
            except Exception as e:
                logger.critical(f"Unexpected error at row '{idx}', id={row_id}: {e}")
    finally:
        stop_processing.set()
        db.close()
    save_state(len(movies))
    logger.info("Processed all available rows")


def populate_db(url: str | None, resume: bool) -> None:
    session_factory, tmdb_client, vector_store = _create_session_and_deps()
    paths = get_populate_db_paths()
    if url:
        if paths["state_file"].exists():
            paths["state_file"].unlink()
        if paths["filtered_daily_ids_export"].exists():
            paths["filtered_daily_ids_export"].unlink()
        download_and_extract_export_file(url)
    else:
        logger.info("URL not provided. Resuming...")

    if paths["filtered_daily_ids_export"].exists():
        movies = pd.read_csv(paths["filtered_daily_ids_export"])
    elif paths["daily_ids_export"].exists():
        movies = pd.read_json(paths["daily_ids_export"], lines=True)
        mask_is_mostly_latin = movies["original_title"].apply(is_mostly_latin)
        print("Movie count:", len(movies))
        movies = movies[mask_is_mostly_latin]
        print("Movie count after filtering:", len(movies))
        movies.to_csv(paths["filtered_daily_ids_export"], index=False)
    else:
        logger.info("File not found. Please provide an URL with --url option and try again.")
        exit(1)

    process_movies(movies, session_factory, tmdb_client, vector_store)


if __name__ == "__main__":
    print("Use the provided command-line tool.")
