"""
Webhook endpoint — receives incoming WhatsApp messages from OpenClaw,
logs them, classifies via AI, and creates a ticket.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MessageLog, Ticket, TicketStatus, TicketPriority
from app.schemas import IncomingMessage, WebhookResponse
from app.services.ai_classifier import classify_complaint

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])


@router.post(
    "/message",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Receive a WhatsApp message from OpenClaw",
)
async def receive_message(payload: IncomingMessage, db: Session = Depends(get_db)):
    """
    Entry point for OpenClaw webhook events.

    1. Logs the raw message.
    2. Classifies the complaint using AI.
    3. Creates and persists a ticket.
    4. Returns the ticket ID, category, and priority.
    """
    log = MessageLog(
        raw_message=payload.message_text,
        sender=payload.sender,
        group_name=payload.group_name,
    )
    db.add(log)
    db.flush()

    try:
        category, priority_str = await classify_complaint(payload.message_text)
    except Exception as exc:
        logger.error("Classification error: %s", exc)
        category, priority_str = "Other", "MEDIUM"

    try:
        priority = TicketPriority(priority_str)
    except ValueError:
        priority = TicketPriority.MEDIUM

    ticket = Ticket(
        message_text=payload.message_text,
        category=category,
        priority=priority,
        location=payload.location,
        status=TicketStatus.OPEN,
        reporter_name=payload.reporter_name,
        group_name=payload.group_name,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    logger.info("Ticket #%d created — category=%s priority=%s", ticket.id, category, priority_str)

    return WebhookResponse(
        ticket_id=ticket.id,
        category=category,
        priority=priority,
    )
