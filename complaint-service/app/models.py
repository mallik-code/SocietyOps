from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    delayed = "delayed"
    closed = "closed"


class TicketPriority(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"
    Critical = "Critical"


class SupervisorActionType(str, enum.Enum):
    started = "started"
    resolved = "resolved"
    delayed = "delayed"


def _utcnow():
    return datetime.now(timezone.utc)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    message_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    priority = Column(SAEnum(TicketPriority), nullable=False, default=TicketPriority.Medium)
    location = Column(String(255), nullable=True)
    status = Column(SAEnum(TicketStatus), nullable=False, default=TicketStatus.open)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
    reporter_name = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)
    is_test = Column(Boolean, default=False)
    confidence = Column(String(20), nullable=True)

    supervisor_actions = relationship("SupervisorAction", back_populates="ticket", cascade="all, delete-orphan")


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    raw_message = Column(Text, nullable=False)
    sender = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)
    
    # New classification fields
    is_complaint = Column(Boolean, nullable=True)
    category = Column(String(100), nullable=True)
    priority = Column(String(50), nullable=True)
    confidence = Column(String(20), nullable=True)
    
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    is_test = Column(Boolean, default=False)


class SupervisorAction(Base):
    __tablename__ = "supervisor_actions"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(SAEnum(SupervisorActionType), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    is_test = Column(Boolean, default=False)

    ticket = relationship("Ticket", back_populates="supervisor_actions")
