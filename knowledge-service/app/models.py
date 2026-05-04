from sqlalchemy import Column, Integer, Text, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime, timezone
from app.database import Base

# Use pgvector
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy import PickleType as Vector

def _utcnow():
    return datetime.now(timezone.utc)

class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    collection_id = Column(String(50), index=True, nullable=True)
    document_id = Column(String(100), index=True, nullable=True)
    source_name = Column(String(255), nullable=True)
    page_number = Column(Integer, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    embedding = Column(Vector(768), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
