from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import TicketStatus, TicketPriority, SupervisorActionType
import enum


# ─── Incoming webhook payload ──────────────────────────────────────────────────

class IncomingMessage(BaseModel):
    message_text: str = Field(..., description="Raw complaint text from WhatsApp")
    sender: Optional[str] = Field(None, description="WhatsApp sender ID / phone")
    group_name: Optional[str] = Field(None, description="WhatsApp group name")
    reporter_name: Optional[str] = Field(None, description="Display name of the sender")
    location: Optional[str] = Field(None, description="Caller-provided location hint (AI may override)")


# ─── Classification result (returned by the AI classifier) ────────────────────

class ClassificationResponse(BaseModel):
    is_complaint: bool = Field(..., description="True if the message is a genuine complaint")
    intent: str = Field("NEW_COMPLAINT", description="NEW_COMPLAINT | ISSUE_RESOLUTION | OTHER")
    category: str = Field(..., description="Lift | Garbage | Cleaning | Water | Electrical | Security | Other")
    priority: str = Field(..., description="High | Medium | Low")
    location: Optional[str] = Field(None, description="Location extracted from the message text")
    issue_summary: Optional[str] = Field(None, description="Extracted issue summary for resolutions")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Classifier confidence score (0–1)")


# ─── Standalone classify endpoint ─────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    message_text: str = Field(..., description="Text to classify")


# ─── Ticket schemas ────────────────────────────────────────────────────────────

class TicketBase(BaseModel):
    message_text: str
    category: Optional[str] = None
    priority: TicketPriority = TicketPriority.Medium
    location: Optional[str] = None
    status: TicketStatus = TicketStatus.open
    reporter_name: Optional[str] = None
    group_name: Optional[str] = None
    confidence: Optional[float] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    category: Optional[str] = None
    location: Optional[str] = None


class TicketResponse(TicketBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Message log schemas ───────────────────────────────────────────────────────

class MessageLogResponse(BaseModel):
    id: int
    raw_message: str
    sender: Optional[str]
    group_name: Optional[str]
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─── Supervisor action schemas ─────────────────────────────────────────────────

class SupervisorActionCreate(BaseModel):
    ticket_id: int
    action: SupervisorActionType


class SupervisorActionResponse(SupervisorActionCreate):
    id: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─── Webhook response ──────────────────────────────────────────────────────────

class WebhookResponse(BaseModel):
    ticket_id: Optional[int] = Field(None, description="Null when message is not a complaint")
    is_complaint: bool
    classification: ClassificationResponse
    message: str
    whatsapp_reply: str = Field(..., description="Ready-to-send WhatsApp reply string")


# ─── Report schemas ────────────────────────────────────────────────────────────

class CategorySummary(BaseModel):
    category: str
    count: int


class DailyReport(BaseModel):
    date: str
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    by_category: List[CategorySummary]
    by_priority: List[CategorySummary]
    avg_resolution_time_hours: Optional[float]


# ─── Knowledge schemas ─────────────────────────────────────────────────────────

class KnowledgeCategory(str, enum.Enum):
    PROCEDURE = "procedure"
    CONTACT = "contact"
    POLICY = "policy"
    GENERAL = "general"


class KnowledgeCreate(BaseModel):
    content: str
    category: KnowledgeCategory = KnowledgeCategory.GENERAL
    source_group: Optional[str] = None
    metadata: Optional[dict] = None


class KnowledgeResponse(BaseModel):
    id: int
    content: str
    category: KnowledgeCategory
    source_group: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeSearchQuery(BaseModel):
    query: str
    limit: int = 5
