from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SupervisorActionType(str, enum.Enum):
    STARTED = "STARTED"
    RESOLVED = "RESOLVED"
    DELAYED = "DELAYED"


def _utcnow():
    return datetime.now(timezone.utc)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    message_text = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    priority = Column(SAEnum(TicketPriority), nullable=False, default=TicketPriority.MEDIUM)
    location = Column(String(255), nullable=True)
    status = Column(SAEnum(TicketStatus), nullable=False, default=TicketStatus.OPEN)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)
    reporter_name = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)

    supervisor_actions = relationship("SupervisorAction", back_populates="ticket", cascade="all, delete-orphan")


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    raw_message = Column(Text, nullable=False)
    sender = Column(String(255), nullable=True)
    group_name = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_utcnow)


class SupervisorAction(Base):
    __tablename__ = "supervisor_actions"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(SAEnum(SupervisorActionType), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    ticket = relationship("Ticket", back_populates="supervisor_actions")
