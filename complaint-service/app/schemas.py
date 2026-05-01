from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import TicketStatus, TicketPriority, SupervisorActionType


# ─── Incoming webhook payload ──────────────────────────────────────────────────

class IncomingMessage(BaseModel):
    message_text: str = Field(..., description="Raw complaint text from WhatsApp")
    sender: Optional[str] = Field(None, description="WhatsApp sender ID / phone")
    group_name: Optional[str] = Field(None, description="WhatsApp group name")
    reporter_name: Optional[str] = Field(None, description="Display name of the sender")
    location: Optional[str] = Field(None, description="Location extracted or provided")


# ─── Ticket schemas ────────────────────────────────────────────────────────────

class TicketBase(BaseModel):
    message_text: str
    category: Optional[str] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    location: Optional[str] = None
    status: TicketStatus = TicketStatus.OPEN
    reporter_name: Optional[str] = None
    group_name: Optional[str] = None


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
    ticket_id: int
    category: str
    priority: TicketPriority
    message: str = "Complaint received and classified"


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
