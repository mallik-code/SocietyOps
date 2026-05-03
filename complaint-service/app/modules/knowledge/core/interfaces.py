from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

class EmbeddingProvider(ABC):
    @abstractmethod
    async def get_embedding(self, text: str) -> List[float]:
        pass

class VectorStorageProvider(ABC):
    @abstractmethod
    async def save(self, content: str, embedding: List[float], metadata: Dict[str, Any]) -> Any:
        pass

    @abstractmethod
    async def hybrid_search(self, query: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        pass

class KnowledgeEngine:
    """The orchestrator that doesn't care about which DB or AI model is used"""
    def __init__(self, storage: VectorStorageProvider, embeddings: EmbeddingProvider):
        self.storage = storage
        self.embeddings = embeddings

    async def add(self, content: str, metadata: Dict[str, Any]):
        embedding = await self.embeddings.get_embedding(content)
        return await self.storage.save(content, embedding, metadata)

    async def search(self, query: str, limit: int = 5):
        embedding = await self.embeddings.get_embedding(query)
        return await self.storage.hybrid_search(query, embedding, limit)
