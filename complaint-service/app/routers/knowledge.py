from fastapi import APIRouter, Depends, HTTPException
import httpx
import os
from app.schemas import KnowledgeCreate, KnowledgeResponse
from typing import List

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])

KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://knowledge-service:8000")

@router.post("/ingest", response_model=KnowledgeResponse)
async def ingest_knowledge(payload: KnowledgeCreate):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{KNOWLEDGE_SERVICE_URL}/ingest",
                json=payload.model_dump()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Knowledge Service error: {str(e)}")

@router.get("/search")
async def search_knowledge(query: str, limit: int = 5):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{KNOWLEDGE_SERVICE_URL}/search",
                params={"query": query, "limit": limit}
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"Knowledge Service error: {str(e)}")
