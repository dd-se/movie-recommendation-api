from typing import Any

import chromadb
from chromadb.api.models.Collection import Collection
from chromadb.utils import embedding_functions

from backend.core.logging import get_logger

logger = get_logger(__name__)


class ChromaVectorStore:
    def __init__(self, path: str, model_name: str, use_cuda: bool = False):
        self._path = path
        self._model_name = model_name
        self._use_cuda = use_cuda
        self._collection: Collection | None = None

    def initialize(self) -> None:
        try:
            logger.info("Loading ChromaDB collection...")
            client = chromadb.PersistentClient(path=self._path)
            self._collection = client.get_or_create_collection(
                "documents",
                metadata={"hnsw:space": "cosine"},
                embedding_function=embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name=self._model_name,
                    normalize_embeddings=True,
                    trust_remote_code=True,
                    device="cuda" if self._use_cuda else "cpu",
                ),
            )
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB collection: {e}", exc_info=True)
            exit(1)

    def _ensure_loaded(self) -> None:
        if self._collection is None:
            self.initialize()

    def store(
        self,
        ids: list[str],
        descriptions: list[str],
        metadatas: list[dict[str, Any]],
        max_batch_size: int | None = None,
    ) -> None:
        self._ensure_loaded()
        if max_batch_size is None:
            max_batch_size = 5460
        logger.warning(f"Processing {len(ids)} description(s) in batches of up to {max_batch_size}")
        prefixed_documents = [f"search_document: {doc}" for doc in descriptions]
        for i in range(0, len(ids), max_batch_size):
            batch_ids = ids[i : i + max_batch_size]
            batch_documents = prefixed_documents[i : i + max_batch_size]
            batch_metadatas = metadatas[i : i + max_batch_size]
            self._collection.add(ids=batch_ids, documents=batch_documents, metadatas=batch_metadatas)
        logger.warning("Processing completed")

    def query(
        self,
        query_text: str,
        where_filter: dict[str, Any] | None = None,
        where_document_filter: dict[str, Any] | None = None,
        k: int = 50,
        max_distance: float = 0.39,
    ) -> list[dict[str, Any]]:
        self._ensure_loaded()
        logger.debug(f"Query: '{query_text}' | where={where_filter} | doc_filter={where_document_filter}")
        results = self._collection.query(
            query_texts=[f"search_query: {query_text}"],
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
