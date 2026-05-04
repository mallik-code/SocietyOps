import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.repositories.knowledge_repository import KnowledgeRepository
from app.services.knowledge_service import KnowledgeService
from app.infrastructure.gemini_embeddings import GeminiEmbeddingProvider
from app.infrastructure.openai_embeddings import OpenAICompatibleEmbeddingProvider
from app.schemas import KnowledgeCreate, KnowledgeResponse, SearchResult, CategoryResponse
from typing import List, Optional

router = APIRouter(prefix="", tags=["Knowledge"])

async def get_knowledge_service(db: AsyncSession = Depends(get_db)) -> KnowledgeService:
    provider_type = os.getenv("EMBEDDING_PROVIDER", "gemini").lower()
    
    # 1. Setup Embedding Provider
    if provider_type == "gemini":
        api_key = os.getenv("EMBEDDING_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMBEDDING_API_KEY not configured")
        embeddings = GeminiEmbeddingProvider(api_key)
    elif provider_type in ["openai", "groq", "generic"]:
        api_key = os.getenv("EMBEDDING_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="EMBEDDING_API_KEY not configured")
        embeddings = OpenAICompatibleEmbeddingProvider(api_key)
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported embedding provider: {provider_type}")
    
    # 2. Setup Repository
    repo = KnowledgeRepository(db)
    
    # 3. Return Service
    return KnowledgeService(repo, embeddings)

@router.post("/ingest", response_model=KnowledgeResponse)
async def ingest(payload: KnowledgeCreate, service: KnowledgeService = Depends(get_knowledge_service)):
    return await service.ingest_knowledge(
        content=payload.content,
        category=payload.category,
        metadata=payload.metadata or {},
        collection_id=payload.collection_id,
        document_id=payload.document_id,
        source_name=payload.source_name,
        page_number=payload.page_number
    )

@router.get("/search", response_model=List[SearchResult])
async def search(query: str, limit: int = 5, collection_id: Optional[str] = None, service: KnowledgeService = Depends(get_knowledge_service)):
    return await service.search_knowledge(query, limit, collection_id)

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(q: Optional[str] = None, service: KnowledgeService = Depends(get_knowledge_service)):
    return await service.get_categories(search=q)

@router.get("/documents")
async def list_documents(collection_id: str, service: KnowledgeService = Depends(get_knowledge_service)):
    return await service.get_documents(collection_id)
