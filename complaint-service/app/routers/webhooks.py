"""
Webhook endpoint — receives incoming WhatsApp messages from OpenClaw,
logs them, classifies via GROQ AI, and creates a ticket when policy allows.
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
from app.services.ai_classifier import classify_complaint, ClassificationResult
from app.services.policy_engine import (
    evaluate_inbound,
    evaluate_classification,
    reply_allowed,
)
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])

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
    Entry point for direct webhook calls.

    1. Policy Phase 1 — inbound checks (group, sender, length, keywords).
    2. Logs the raw message.
    3. AI classification.
    4. Policy Phase 2 — complaint + confidence checks.
    5. Creates a ticket if policy allows.
    6. Returns full classification + whatsapp_reply string.
    """
    # ── Policy Phase 1 ────────────────────────────────────────────────────────
    inbound = evaluate_inbound(
        message_text=payload.message_text,
        group_id=None,
        group_name=payload.group_name,
        sender_id=payload.sender,
    )
    if not inbound.allow_processing:
        return WebhookResponse(
            ticket_id=None,
            is_complaint=False,
            classification=ClassificationResponse(
                is_complaint=False, category="Other",
                priority="Low", location=None, confidence=0.0,
            ),
            message=f"Blocked by policy — {inbound.reason}",
            whatsapp_reply="",
        )

    # ── Log raw message ───────────────────────────────────────────────────────
    db.add(MessageLog(
        raw_message=payload.message_text,
        sender=payload.sender,
        group_name=payload.group_name,
    ))
    db.flush()

    # ── AI classification ─────────────────────────────────────────────────────
    try:
        result = await classify_complaint(payload.message_text)
    except Exception as exc:
        logger.error("Classification error: %s", exc)
        result = ClassificationResult(
            is_complaint=True, category="Other",
            priority="Medium", location=None, confidence=0.0,
        )

    classification = ClassificationResponse(
        is_complaint=result.is_complaint,
        category=result.category,
        priority=result.priority,
        location=result.location or payload.location,
        confidence=result.confidence,
    )

    # ── Policy Phase 2 ────────────────────────────────────────────────────────
    post = evaluate_classification(
        is_complaint=result.is_complaint,
        confidence=result.confidence,
    )

    ticket_id: int | None = None
    whatsapp_reply: str

    if post.allow_ticket:
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
        whatsapp_reply = generate_whatsapp_reply(ticket) if post.allow_reply else ""
        logger.info(
            "Ticket #%d created — category=%s priority=%s confidence=%.2f",
            ticket_id, result.category, result.priority, result.confidence,
        )
        message = "Complaint received and ticket created"
    else:
        db.commit()
        whatsapp_reply = generate_ignored_reply() if (result.is_complaint and post.allow_reply) else ""
        message = f"Message not actioned — {post.reason}"
        logger.info("Ticket skipped — %s — sender=%s", post.reason, payload.sender)

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
    Standalone classification — no DB writes, no policy enforcement.
    Useful for testing the AI classifier in isolation.
    """
    result = await classify_complaint(payload.message_text)
    return ClassificationResponse(**result.to_dict())
