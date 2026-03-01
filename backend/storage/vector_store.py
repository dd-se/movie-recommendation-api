import os
from pathlib import Path

import chromadb
from chromadb.utils import embedding_functions

from ..logger import get_logger

logger = get_logger(__name__)


VECTOR_STORE_PATH = Path(__file__).parent.parent.parent / "data" / "vector_store"
VECTOR_STORE_PATH.mkdir(parents=True, exist_ok=True)

CHROMA_CLIENT = chromadb.PersistentClient(path=str(VECTOR_STORE_PATH))
USE_CUDA = os.getenv("USE_CUDA", "").lower() == "true"
MODEL = "nomic-ai/nomic-embed-text-v1.5"
COLLECTION = None


def load_collection():
    global COLLECTION
    if COLLECTION is not None:
        return

    try:
        logger.info("Loading ChromaDB collection...")
        COLLECTION = CHROMA_CLIENT.get_or_create_collection(
            "documents",
            metadata={"hnsw:space": "cosine"},
            embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=MODEL,
                normalize_embeddings=True,
                trust_remote_code=True,
                device="cuda" if USE_CUDA else "cpu",
            ),
        )
    except Exception as e:
        logger.error(f"Failed to initialize ChromaDB collection: {e}", exc_info=True)
        exit(1)


def store_movie_descriptions(
    ids: list[str], descriptions: list[str], metadatas: list[dict[str, int]], max_batch_size=5460
) -> None:
    """Processes movie descriptions, generates an embeddings, and stores them in the ChromaDB collection."""
    load_collection()
    logger.warning(f"Processing {len(ids)} description(s) in batches of up to {max_batch_size}")
    prefixed_documents = [f"search_document: {doc}" for doc in descriptions]
    for i in range(0, len(ids), max_batch_size):
        batch_ids = ids[i : i + max_batch_size]
        batch_documents = prefixed_documents[i : i + max_batch_size]
        batch_metadatas = metadatas[i : i + max_batch_size]
        COLLECTION.add(ids=batch_ids, documents=batch_documents, metadatas=batch_metadatas)

    logger.warning("Processing completed")


def get_relevant_movies(
    query: str, where_filter: dict = None, where_document_filter: dict = None, k: int = 50, max_distance: float = 0.39
) -> list[dict]:
    load_collection()
    logger.debug(f"Received raw query: '{query}'")
    logger.debug(f"Where filter: '{where_filter}'")
    logger.debug(f"Doc filter: '{where_document_filter}'")

    results = COLLECTION.query(
        query_texts=[f"search_query: {query}"],
        n_results=k,
        include=["metadatas", "distances"],
        where=where_filter,
        where_document=where_document_filter,
    )
    distances = results["distances"][0]
    metadatas = results["metadatas"][0]
    metadatas = [m for m, d in zip(metadatas, distances) if d < max_distance]
    logger.info("Retrieval completed")
    return metadatas
