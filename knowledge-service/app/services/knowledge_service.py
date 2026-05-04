from typing import List, Dict, Any, Optional
from app.repositories.knowledge_repository import KnowledgeRepository
from societyops_dependencies.interfaces.ai import EmbeddingProvider

class KnowledgeService:
    def __init__(self, repository: KnowledgeRepository, embedding_provider: EmbeddingProvider):
        self.repository = repository
        self.embedding_provider = embedding_provider

    async def ingest_knowledge(
        self, 
        content: str, 
        category: str = "general", 
        metadata: Dict[str, Any] = None,
        collection_id: str = None,
        document_id: str = None,
        source_name: str = None,
        page_number: int = None
    ):
        embedding = await self.embedding_provider.get_embedding(content)
        return await self.repository.save(
            content=content,
            embedding=embedding,
            category=category,
            metadata=metadata,
            collection_id=collection_id,
            document_id=document_id,
            source_name=source_name,
            page_number=page_number
        )

    async def search_knowledge(self, query: str, limit: int = 5, collection_id: str = None):
        embedding = await self.embedding_provider.get_embedding(query)
        return await self.repository.hybrid_search(
            query=query,
            embedding=embedding,
            limit=limit,
            collection_id=collection_id
        )

    async def get_categories(self, search: Optional[str] = None):
        return await self.repository.get_categories(search)

    async def get_documents(self, collection_id: str):
        return await self.repository.get_documents(collection_id)
