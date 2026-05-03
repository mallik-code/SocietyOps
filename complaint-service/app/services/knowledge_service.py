import httpx
from typing import List, Dict, Any, Optional
from app.repositories.knowledge_repository import KnowledgeRepository
from app.models import KnowledgeItem, KnowledgeCategory

class KnowledgeService:
    def __init__(self, repository: KnowledgeRepository, api_key: str):
        self.repository = repository
        self.api_key = api_key
        self.embedding_url = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

    async def _get_embedding(self, text_content: str) -> List[float]:
        """External API call to Gemini for embeddings"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.embedding_url}?key={self.api_key}",
                json={
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text_content}]}
                }
            )
            response.raise_for_status()
            return response.json()["embedding"]["values"]

    async def ingest_knowledge(
        self, 
        content: str, 
        category: KnowledgeCategory, 
        source_group: Optional[str] = None, 
        metadata: Optional[Dict[str, Any]] = None
    ) -> KnowledgeItem:
        """Business logic: Generate embedding then save via repository"""
        embedding = await self._get_embedding(content)
        
        item = KnowledgeItem(
            content=content,
            category=category,
            source_group=source_group,
            metadata_json=metadata,
            embedding=embedding
        )
        
        return await self.repository.create(item)

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Business logic: Generate query embedding then search via repository"""
        query_embedding = await self._get_embedding(query)
        return await self.repository.hybrid_search(query, query_embedding, limit)
