from abc import ABC, abstractmethod
from typing import List, Dict, Any

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
