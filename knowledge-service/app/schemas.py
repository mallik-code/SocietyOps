from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class KnowledgeCreate(BaseModel):
    content: str
    category: Optional[str] = "general"
    metadata: Optional[Dict[str, Any]] = None

class KnowledgeResponse(BaseModel):
    id: int
    content: str
    category: Optional[str]
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    id: int
    content: str
    category: Optional[str]
    rrf_score: float
    created_at: datetime
    metadata_json: Optional[Dict[str, Any]]

class CategoryResponse(BaseModel):
    name: str
    topic_count: int
    last_updated: datetime

