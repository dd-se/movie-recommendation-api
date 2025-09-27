from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from ..external.tmdb import fetch_movie_details, fetch_now_playing_tmdb_ids, fetch_popular_tmdb_ids, fetch_top_rated_tmdb_ids
from ..logger import get_logger
from ..storage.db import Movie, MovieQueue, QueueStatus, backup_db, get_db
from ..storage.vector_store import store_movie_descriptions

logger = get_logger(__name__)


def job_fetch_current_movies(pages: int = 1):
    logger.info(f"Starting fetch_current_movies job for '{pages}' page(s).")
    try:
        db = get_db()

        for page in range(1, pages + 1):
            logger.info(f"Processing page {page}...")
            try:
                now_playing = fetch_now_playing_tmdb_ids(page)
                top_rated = fetch_top_rated_tmdb_ids(page)
                popular = fetch_popular_tmdb_ids(page)
                fetched_tmdb_ids = now_playing | top_rated | popular

                q = select(Movie.tmdb_id).where(Movie.tmdb_id.in_(fetched_tmdb_ids))
                tmdb_ids_in_db = db.execute(q).scalars().all()

                tmdb_ids_not_in_db = fetched_tmdb_ids - set(tmdb_ids_in_db)

                if not tmdb_ids_not_in_db:
                    logger.info(f"No new movies to add from page {page}.")
                    continue

                new_movies_to_add = []

                for tmdb_id in tmdb_ids_not_in_db:
                    try:
                        validated_movie = fetch_movie_details(tmdb_id)

                        if validated_movie.is_my_kind_of_movie():
                            movie = Movie(**validated_movie.model_dump())
                            queue_entry = MovieQueue(tmdb_id=validated_movie.tmdb_id)

                            new_movies_to_add.append(movie)
                            new_movies_to_add.append(queue_entry)

                    except Exception as e:
                        logger.error(f"Failed to process movie ID '{tmdb_id}': {e}", exc_info=True)

                if not new_movies_to_add:
                    logger.info(f"Found {len(tmdb_ids_not_in_db)} new IDs, but none were my kind of movie.")
                    continue

                db.add_all(new_movies_to_add)
                db.commit()
                logger.warning(f"Added '{len(new_movies_to_add) // 2}' new movies from page {page}")

            except Exception as e:
                logger.error(f"Unexpected error while fetching movies on page {page}: '{e}'", exc_info=True)
                db.rollback()

    finally:
        db.close()

    logger.info("Finished fetch_current_movies job")


def process_queue_refresh_database(limit: int = 10000):
    logger.info(f"Starting process_queue_refresh_database job with a limit of '{limit}'")

    try:
        db = get_db()
        q = (
            select(MovieQueue)
            .where(MovieQueue.status == QueueStatus.REFRESH_DATA)
            .order_by(MovieQueue.updated_at.asc())
            .limit(limit)
        )
        movie_queues = db.execute(q).scalars().all()

        if not movie_queues:
            logger.info("No movie in need of refresh. Returning...")
            return

        logger.info(f"Found {len(movie_queues)} movie(s) to refresh.")

        fail_count = 0
        changed_movies_count = 0
        for queue in movie_queues:
            try:
                validated_movie = fetch_movie_details(queue.tmdb_id)
                changed = queue.movie.update(validated_movie)

                if changed:
                    changed_movies_count += 1
                    queue.status = QueueStatus.PREPROCESS_DESCRIPTION

                else:
                    queue.status = QueueStatus.COMPLETED

                if queue.retries > 0:
                    queue.retries = 0
                    queue.message = None

            except Exception as e:
                logger.error(f"Failed to refresh movie TMDB ID '{queue.tmdb_id}': {e}", exc_info=True)
                queue.retries += 1
                fail_count += 1
                queue.message = str(e)
                if queue.retries > 2:
                    queue.status = QueueStatus.FAILED

        logger.warning(
            f"Refreshed '{len(movie_queues)}' movie(s): '{fail_count}' failed, '{changed_movies_count}' with changes."
        )
        db.commit()
    except Exception as e:
        logger.error(f"A critical error occurred during the queue processing job: {e}", exc_info=True)
        db.rollback()

    finally:
        db.close()


def process_queue_descriptions():
    logger.info("Starting process_queue_descriptions job")
    try:
        db = get_db()
        q = (
            select(MovieQueue)
            .where(MovieQueue.status == QueueStatus.PREPROCESS_DESCRIPTION)
            .order_by(MovieQueue.created_at.asc())
        )
        movie_queues = db.execute(q).scalars().all()

        if not movie_queues:
            logger.info("No movie in need of refresh. Returning...")
            return

        try:
            for queue in movie_queues:
                queue.preprocessed_description = queue.movie.get_description()
                queue.status = QueueStatus.CREATE_EMBEDDING

            db.commit()
            logger.info(f"Processed descriptions for '{len(movie_queues)}' movie(s).")
        except Exception as e:
            logger.error(f"Unexpected error while processing movie descriptions: '{e}'", exc_info=True)
            db.rollback()

    finally:
        db.close()


def process_queue_add_to_vector_store():
    logger.info("Starting process_queue_add_to_vector_store job")
    try:
        db = get_db()
        q = select(MovieQueue).where(MovieQueue.status == QueueStatus.CREATE_EMBEDDING).order_by(MovieQueue.created_at.asc())
        movie_queues = db.execute(q).scalars().all()

        if not movie_queues:
            logger.info("No movie in need of new embeddings. Returning...")
            return

        ids: list[str] = []
        descriptions: list[str] = []
        metadatas: list[dict[str, int]] = []

        try:
            for movie_queue in movie_queues:
                ids.append(str(movie_queue.tmdb_id))
                descriptions.append(movie_queue.preprocessed_description)
                metadatas.append(movie_queue.movie.get_metadata())

                movie_queue.status = QueueStatus.COMPLETED

            store_movie_descriptions(ids, descriptions, metadatas)
            db.commit()

        except Exception as e:
            logger.error(f"Unexpected error while processing movie descriptions: '{e}'", exc_info=True)
            db.rollback()

    finally:
        db.close()


JOBS = [
    ("fetch_current_movies", CronTrigger(hour="0,4,8,12,16,20"), job_fetch_current_movies, 6),
    ("process_queue_refresh_database", CronTrigger(minute="0,5,10,20,30,35,40,50"), process_queue_refresh_database),
    ("process_queue_preprocess", CronTrigger(minute="15,45"), process_queue_descriptions),
    ("process_queue_vector_store", CronTrigger(minute="25,55"), process_queue_add_to_vector_store),
]
