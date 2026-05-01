"""
Webhook endpoint — receives incoming WhatsApp messages from OpenClaw,
logs them, classifies via Claude AI, and creates a ticket only if it
is a genuine complaint.
"""
import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MessageLog, Ticket, TicketStatus, TicketPriority
from app.schemas import (
    IncomingMessage,
    WebhookResponse,
    ClassificationResponse,
    ClassifyRequest,
)
from app.services.ai_classifier import classify_complaint
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])

# Maps Claude priority labels → ORM enum values
_PRIORITY_MAP = {
    "High": TicketPriority.HIGH,
    "Medium": TicketPriority.MEDIUM,
    "Low": TicketPriority.LOW,
}


@router.post(
    "/message",
    response_model=WebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive a WhatsApp message from OpenClaw",
)
async def receive_message(payload: IncomingMessage, db: Session = Depends(get_db)):
    """
    Entry point for OpenClaw webhook events.

    1. Logs the raw message for audit.
    2. Classifies the message using Claude (or keyword fallback).
    3. If `is_complaint=true`, creates a tracked ticket.
    4. If `is_complaint=false` (greeting, casual, spam), logs but skips ticket creation.
    5. Returns the full classification JSON plus the ticket ID (null when not a complaint).
    """
    log = MessageLog(
        raw_message=payload.message_text,
        sender=payload.sender,
        group_name=payload.group_name,
    )
    db.add(log)
    db.flush()

    try:
        result = await classify_complaint(payload.message_text)
    except Exception as exc:
        logger.error("Classification error: %s", exc)
        from app.services.ai_classifier import ClassificationResult
        result = ClassificationResult(
            is_complaint=True,
            category="Other",
            priority="Medium",
            location=None,
            confidence=0.0,
        )

    classification = ClassificationResponse(
        is_complaint=result.is_complaint,
        category=result.category,
        priority=result.priority,
        location=result.location or payload.location,
        confidence=result.confidence,
    )

    ticket_id: int | None = None

    CONFIDENCE_THRESHOLD = 0.7

    whatsapp_reply: str

    if result.is_complaint and result.confidence > CONFIDENCE_THRESHOLD:
        priority = _PRIORITY_MAP.get(result.priority, TicketPriority.MEDIUM)
        ticket = Ticket(
            message_text=payload.message_text,
            category=result.category,
            priority=priority,
            location=result.location or payload.location,
            status=TicketStatus.OPEN,
            reporter_name=payload.reporter_name,
            group_name=payload.group_name,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        ticket_id = ticket.id
        whatsapp_reply = generate_whatsapp_reply(ticket)
        logger.info(
            "Ticket #%d created — category=%s priority=%s confidence=%.2f",
            ticket_id, result.category, result.priority, result.confidence,
        )
        message = "Complaint received and ticket created"
    else:
        db.commit()
        if not result.is_complaint:
            reason = "message is not a complaint"
        else:
            reason = f"confidence {result.confidence:.2f} is below threshold {CONFIDENCE_THRESHOLD}"
        logger.info("Message ignored (%s) — sender=%s", reason, payload.sender)
        message = f"Message ignored — {reason}"
        whatsapp_reply = generate_ignored_reply()

    return WebhookResponse(
        ticket_id=ticket_id,
        is_complaint=result.is_complaint,
        classification=classification,
        message=message,
        whatsapp_reply=whatsapp_reply,
    )


@router.post(
    "/classify",
    response_model=ClassificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify a message without creating a ticket",
)
async def classify_only(payload: ClassifyRequest):
    """
    Standalone classification endpoint — useful for testing or
    pre-screening messages before sending to the webhook.
    Returns the raw classification JSON without touching the database.
    """
    result = await classify_complaint(payload.message_text)
    return ClassificationResponse(**result.to_dict())
