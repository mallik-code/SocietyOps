"""
Webhook endpoint — receives incoming WhatsApp messages from OpenClaw,
logs them, classifies via GROQ AI, and creates a ticket when policy allows.
"""
import logging
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    IncomingMessage,
    WebhookResponse,
    ClassificationResponse,
    ClassifyRequest,
)
from app.services.ai_classifier import classify_complaint
from app.services.message_orchestrator import MessageOrchestrator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])


@router.post(
    "/message",
    response_model=WebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive a WhatsApp message from OpenClaw",
)
async def receive_message(payload: IncomingMessage, db: Session = Depends(get_db)):
    """
    Entry point for direct webhook calls.
    Delegates orchestration to MessageOrchestrator.
    """
    # ── Orchestration ─────────────────────────────────────────────────────────
    orchestrator = MessageOrchestrator(db)
    result = await orchestrator.process_message(
        message_text=payload.message_text,
        sender_jid=payload.sender,
        sender_name=payload.reporter_name,
        group_name=payload.group_name
    )

    # ── Response formatting ───────────────────────────────────────────────────
    classification_resp = None
    if result.classification:
        classification_resp = ClassificationResponse(
            is_complaint=result.classification.is_complaint,
            intent=result.classification.intent,
            category=result.classification.category,
            priority=result.classification.priority,
            location=result.classification.location or payload.location,
            issue_summary=result.classification.issue_summary,
            confidence=result.classification.confidence,
        )

    return WebhookResponse(
        ticket_id=result.ticket_id or result.matched_ticket_id,
        is_complaint=result.classification.is_complaint if result.classification else False,
        classification=classification_resp,
        message=result.reason,
        whatsapp_reply=result.whatsapp_reply or "",
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
    return ClassificationResponse(
        is_complaint=result.is_complaint,
        intent=result.intent,
        category=result.category,
        priority=result.priority,
        location=result.location,
        issue_summary=result.issue_summary,
        confidence=result.confidence,
    )
