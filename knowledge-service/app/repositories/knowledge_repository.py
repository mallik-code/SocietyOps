from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any
from app.models import KnowledgeItem

HYBRID_SEARCH_QUERY = """
WITH vector_search AS (
    SELECT id, 
           1 - (embedding <=> :embedding::vector) AS rank_score,
           ROW_NUMBER() OVER (ORDER BY embedding <=> :embedding::vector) AS rank
    FROM knowledge_items
    LIMIT 50
),
keyword_search AS (
    SELECT id, 
           ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) AS rank_score,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', :query)) DESC) AS rank
    FROM knowledge_items
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', :query)
    LIMIT 50
)
SELECT k.id, k.content, k.category, k.created_at, k.metadata_json,
       COALESCE(1.0 / (60 + v.rank), 0.0) + COALESCE(1.0 / (60 + kw.rank), 0.0) AS rrf_score,
       CASE 
           WHEN k.created_at > NOW() - INTERVAL '30 days' THEN 1.2
           ELSE 1.0
       END AS temporal_boost
FROM knowledge_items k
LEFT JOIN vector_search v ON k.id = v.id
LEFT JOIN keyword_search kw ON k.id = kw.id
WHERE v.id IS NOT NULL OR kw.id IS NOT NULL
ORDER BY (rrf_score * temporal_boost) DESC
LIMIT :limit;
"""

class KnowledgeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def save(self, content: str, embedding: List[float], category: str, metadata: Dict[str, Any]) -> KnowledgeItem:
        item = KnowledgeItem(
            content=content,
            embedding=embedding,
            category=category,
            metadata_json=metadata
        )
        self.session.add(item)
        await self.session.flush()
        return item

    async def hybrid_search(self, query: str, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        result = await self.session.execute(
            text(HYBRID_SEARCH_QUERY),
            {
                "embedding": str(embedding),
                "query": query,
                "limit": limit
            }
        )
        return result.mappings().all()

    async def get_categories(self, search: str = None) -> List[Dict[str, Any]]:
        query = """
        SELECT category as name, 
               COUNT(*) as topic_count, 
               MAX(created_at) as last_updated
        FROM knowledge_items
        """
        params = {}
        if search:
            query += " WHERE category ILIKE :search"
            params["search"] = f"%{search}%"
        
        query += " GROUP BY category ORDER BY category ASC"
        
        result = await self.session.execute(text(query), params)
        return result.mappings().all()
