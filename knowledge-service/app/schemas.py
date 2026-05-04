from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class KnowledgeCreate(BaseModel):
    content: str
    category: Optional[str] = "general"
    collection_id: Optional[str] = None
    document_id: Optional[str] = None
    source_name: Optional[str] = None
    page_number: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class KnowledgeResponse(BaseModel):
    id: int
    content: str
    category: Optional[str]
    collection_id: Optional[str]
    document_id: Optional[str]
    source_name: Optional[str]
    page_number: Optional[int]
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    id: int
    content: str
    category: Optional[str]
    collection_id: Optional[str]
    document_id: Optional[str]
    source_name: Optional[str]
    page_number: Optional[int]
    rrf_score: float
    created_at: datetime
    metadata_json: Optional[Dict[str, Any]]

class CategoryResponse(BaseModel):
    name: str
    topic_count: int
    last_updated: datetime

