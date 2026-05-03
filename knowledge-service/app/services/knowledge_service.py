from typing import List, Dict, Any
from app.repositories.knowledge_repository import KnowledgeRepository
from societyops_dependencies.interfaces.ai import EmbeddingProvider

class KnowledgeService:
    def __init__(self, repository: KnowledgeRepository, embedding_provider: EmbeddingProvider):
        self.repository = repository
        self.embedding_provider = embedding_provider

    async def ingest_knowledge(self, content: str, category: str, metadata: Dict[str, Any]):
        embedding = await self.embedding_provider.get_embedding(content)
        return await self.repository.save(
            content=content,
            embedding=embedding,
            category=category,
            metadata=metadata
        )

    async def search_knowledge(self, query: str, limit: int = 5):
        embedding = await self.embedding_provider.get_embedding(query)
        return await self.repository.hybrid_search(
            query=query,
            embedding=embedding,
            limit=limit
        )

    async def get_categories(self, search: str = None):
        return await self.repository.get_categories(search)
