from dotenv import load_dotenv

load_dotenv()
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

from ..core.database import get_db, init_db
from ..core.logging import get_logger
from ..external.tmdb import fetch_movie_details
from ..models import Movie, MovieQueue
from ..scheduler.jobs import process_queue_add_to_vector_store, process_queue_descriptions

logger = get_logger(__name__)

POP_DB_PATH = Path(__file__).parent.parent.parent / "data" / "populate_db"
POP_DB_PATH.mkdir(parents=True, exist_ok=True)
DAILY_IDS_EXPORT = POP_DB_PATH / "tmdb_daily_ids_export.json"
FILTERED_DAILY_IDS_EXPORT = POP_DB_PATH / "tmdb_ids_filtered.csv"
STATE_FILE = POP_DB_PATH / "resume_from_index.json"
LATIN_CHARS = regex.compile(r"[\p{Latin}0-9\s.,!?;:/\'\"()\-\[\]–—\u201c\u201d\u2018\u2019@]")


def download_and_extract_export_file(url: str) -> None:
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        with gzip.GzipFile(fileobj=r.raw) as f_in:
            with open(DAILY_IDS_EXPORT, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
    print(f"Extracted: {DAILY_IDS_EXPORT}")


def is_mostly_latin(text: str, threshold: float = 0.9) -> bool:
    text = text.strip()
    text_len = len(text)
    if text_len == 0:
        return False
    latin_count = len(LATIN_CHARS.findall(text))
    return (latin_count / text_len) >= threshold


def save_state(idx: int) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump({"resume_from_index": idx}, f)
        logger.info(f"Resume index set to '{idx}'")


def load_state() -> int:
    if not STATE_FILE.exists():
        return 0
    with open(STATE_FILE) as f:
        return json.load(f).get("resume_from_index", 0)


def finish_processing_in_background(stop_processing: threading.Event) -> None:
    while not stop_processing.is_set():
        process_queue_descriptions()
        process_queue_add_to_vector_store()
        sleep(10)


def process_movies(movies: pd.DataFrame) -> None:
    start_idx = load_state()
    logger.info(f"Resuming from index '{start_idx}'")
    db = get_db()
    stop_processing = threading.Event()
    threading.Thread(target=finish_processing_in_background, args=(stop_processing,), daemon=True).start()
    try:
        current_ids = set(db.execute(select(Movie.tmdb_id)).scalars().all())
        added_counter = 0
        for idx, row in movies.iloc[start_idx:].iterrows():
            try:
                row_id = row.get("id")
                if row_id in current_ids:
                    continue
                validated_movie = fetch_movie_details(row_id)
                if not validated_movie.is_my_kind_of_movie():
                    continue
                movie = Movie(**validated_movie.model_dump())
                queue_entry = MovieQueue(tmdb_id=validated_movie.tmdb_id)
                db.add_all([movie, queue_entry])
                added_counter += 1
                if added_counter % 50 == 0:
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
    init_db()
    if url:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
        if FILTERED_DAILY_IDS_EXPORT.exists():
            FILTERED_DAILY_IDS_EXPORT.unlink()
        download_and_extract_export_file(url)
    else:
        logger.info("URL not provided. Resuming...")

    if FILTERED_DAILY_IDS_EXPORT.exists():
        movies = pd.read_csv(FILTERED_DAILY_IDS_EXPORT)
    elif DAILY_IDS_EXPORT.exists():
        movies = pd.read_json(DAILY_IDS_EXPORT, lines=True)
        mask_is_mostly_latin = movies["original_title"].apply(is_mostly_latin)
        print("Movie count:", len(movies))
        movies = movies[mask_is_mostly_latin]
        print("Movie count after filtering:", len(movies))
        movies.to_csv(FILTERED_DAILY_IDS_EXPORT, index=False)
    else:
        logger.info("File not found. Please provide an URL with --url option and try again.")
        exit(1)

    process_movies(movies)


if __name__ == "__main__":
    print("Use the provided command-line tool.")
