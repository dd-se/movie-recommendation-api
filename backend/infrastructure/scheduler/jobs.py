
from typing import Any

from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session, sessionmaker

from backend.core.logging import get_logger
from backend.core.settings import Settings
from backend.domain.policies import is_acceptable_movie
from backend.infrastructure.db.models import Movie, MovieQueue, QueueStatus
from backend.infrastructure.db.repositories.movie import MovieRepository
from backend.infrastructure.external.tmdb_client import TMDBClient
from backend.infrastructure.vector.chroma_store import ChromaVectorStore

logger = get_logger(__name__)


def job_fetch_current_movies(
    session_factory: sessionmaker[Session],
    tmdb_client: TMDBClient,
    settings: Settings,
    pages: int = 1,
) -> None:
    logger.info(f"Starting fetch_current_movies job for '{pages}' page(s).")
    session = None
    try:
        session = session_factory()
        movie_repo = MovieRepository(session)

        for page in range(1, pages + 1):
            logger.info(f"Processing page {page}...")
            try:
                now_playing = tmdb_client.fetch_now_playing_ids(page)
                top_rated = tmdb_client.fetch_top_rated_ids(page)
                popular = tmdb_client.fetch_popular_ids(page)
                fetched_tmdb_ids = now_playing | top_rated | popular

                tmdb_ids_in_db = movie_repo.find_tmdb_ids_in_db(fetched_tmdb_ids)
                tmdb_ids_not_in_db = fetched_tmdb_ids - set(tmdb_ids_in_db)

                if not tmdb_ids_not_in_db:
                    logger.info(f"No new movies to add from page {page}.")
                    continue

                new_movies_to_add: list[Movie | MovieQueue] = []
                for tmdb_id in tmdb_ids_not_in_db:
                    try:
                        validated_movie = tmdb_client.fetch_movie_details(tmdb_id)
                        if is_acceptable_movie(validated_movie.genres, validated_movie.spoken_languages):
                            new_movies_to_add.append(Movie(**validated_movie.model_dump()))
                            new_movies_to_add.append(MovieQueue(tmdb_id=validated_movie.tmdb_id))
                    except Exception as e:
                        logger.error(f"Failed to process movie ID '{tmdb_id}': {e}", exc_info=True)

                if not new_movies_to_add:
                    logger.info(f"Found {len(tmdb_ids_not_in_db)} new IDs, but none were my kind of movie.")
                    continue

                movie_repo.add_all(new_movies_to_add)
                session.commit()
                logger.warning(f"Added '{len(new_movies_to_add) // 2}' new movies from page {page}")

            except Exception as e:
                logger.error(f"Unexpected error while fetching movies on page {page}: '{e}'", exc_info=True)
                session.rollback()
    finally:
        if session:
            session.close()

    logger.info("Finished fetch_current_movies job")


def process_queue_refresh_database(
    session_factory: sessionmaker[Session],
    tmdb_client: TMDBClient,
    settings: Settings,
    limit: int = 10000,
) -> None:
    actual_limit = limit if limit != 10000 else settings.scheduler.refresh_limit
    logger.info(f"Starting process_queue_refresh_database job with a limit of '{actual_limit}'")
    session = None
    try:
        session = session_factory()
        from backend.infrastructure.db.repositories.queue import QueueRepository
        queue_repo = QueueRepository(session)
        movie_queues = queue_repo.find_by_status(
            QueueStatus.REFRESH_DATA, order_by_updated=True, limit=actual_limit
        )

        if not movie_queues:
            logger.info("No movie in need of refresh. Returning...")
            return

        logger.info(f"Found {len(movie_queues)} movie(s) to refresh.")
        fail_count = 0
        changed_movies_count = 0

        for queue in movie_queues:
            try:
                validated_movie = tmdb_client.fetch_movie_details(queue.tmdb_id)
                changed = queue.movie.update(validated_movie)
                queue.status = QueueStatus.PREPROCESS_DESCRIPTION if changed else QueueStatus.COMPLETED
                if changed:
                    changed_movies_count += 1
                if queue.retries > 0:
                    queue.retries = 0
                    queue.message = None
            except Exception as e:
                logger.error(f"Failed to refresh movie TMDB ID '{queue.tmdb_id}': {e}", exc_info=True)
                queue.retries += 1
                fail_count = 1
                queue.message = str(e)
                if queue.retries > settings.scheduler.max_retries:
                    queue.status = QueueStatus.FAILED

        logger.warning(f"Refreshed '{len(movie_queues)}' movie(s): '{fail_count}' failed, '{changed_movies_count}' with changes.")
        session.commit()
    except Exception as e:
        logger.error(f"A critical error occurred during the queue processing job: {e}", exc_info=True)
        if session:
            session.rollback()
    finally:
        if session:
            session.close()


def process_queue_descriptions(session_factory: sessionmaker[Session]) -> None:
    logger.info("Starting process_queue_descriptions job")
    session = None
    try:
        session = session_factory()
        from backend.infrastructure.db.repositories.queue import QueueRepository
        queue_repo = QueueRepository(session)
        movie_queues = queue_repo.find_by_status(QueueStatus.PREPROCESS_DESCRIPTION)

        if not movie_queues:
            logger.info("No movie in need of refresh. Returning...")
            return

        try:
            for queue in movie_queues:
                queue.preprocessed_description = queue.movie.get_description()
                queue.status = QueueStatus.CREATE_EMBEDDING
            session.commit()
            logger.info(f"Processed descriptions for '{len(movie_queues)}' movie(s).")
        except Exception as e:
            logger.error(f"Unexpected error while processing movie descriptions: {e}", exc_info=True)
            session.rollback()
    finally:
        if session:
            session.close()


def process_queue_add_to_vector_store(
    session_factory: sessionmaker[Session], vector_store: ChromaVectorStore,
) -> None:
    logger.info("Starting process_queue_add_to_vector_store job")
    session = None
    try:
        session = session_factory()
        from backend.infrastructure.db.repositories.queue import QueueRepository
        queue_repo = QueueRepository(session)
        movie_queues = queue_repo.find_by_status(QueueStatus.CREATE_EMBEDDING)

        if not movie_queues:
            logger.info("No movie in need of new embeddings. Returning...")
            return

        ids: list[str] = []
        descriptions: list[str] = []
        metadatas: list[dict[str, Any]] = []

        try:
            for movie_queue in movie_queues:
                ids.append(str(movie_queue.tmdb_id))
                descriptions.append(movie_queue.preprocessed_description or "")
                metadatas.append(movie_queue.movie.get_metadata())
                movie_queue.status = QueueStatus.COMPLETED
            vector_store.store(ids, descriptions, metadatas)
            session.commit()
        except Exception as e:
            logger.error(f"Unexpected error while processing movie descriptions: {e}", exc_info=True)
            session.rollback()
    finally:
        if session:
            session.close()


def get_jobs(
    session_factory: sessionmaker[Session],
    tmdb_client: TMDBClient,
    vector_store: ChromaVectorStore,
    settings: Settings,
) -> list[tuple[Any, ...]]:
    s = settings.scheduler
    return [
        ("fetch_current_movies", CronTrigger(hour=s.fetch_cron_hours), job_fetch_current_movies, session_factory, tmdb_client, settings, 6),
        ("process_queue_refresh_database", CronTrigger(minute=s.refresh_cron_minutes), process_queue_refresh_database, session_factory, tmdb_client, settings),
        ("process_queue_preprocess", CronTrigger(minute=s.preprocess_cron_minutes), process_queue_descriptions, session_factory),
        ("process_queue_vector_store", CronTrigger(minute=s.vector_store_cron_minutes), process_queue_add_to_vector_store, session_factory, vector_store),
    ]
