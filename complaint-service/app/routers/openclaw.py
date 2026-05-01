"""
OpenClaw webhook handler.

OpenClaw calls POST /openclaw/events for every WhatsApp message event.
This router:
  1. Validates the event type (only "message" events are processed).
  2. Applies group filtering — ignores messages from non-allowed groups.
  3. Extracts text, sender, and group from the payload.
  4. Runs the full complaint pipeline (log → classify → optionally create ticket).
  5. Sends the generated WhatsApp reply back to the same group via OpenClaw API.

Expected OpenClaw webhook payload shape:
{
  "event": "message",
  "data": {
    "id": "msg_abc123",
    "text": "The lift on 3rd floor is broken urgently",
    "from": {
      "id": "92300123456@s.whatsapp.net",
      "name": "Ahmed Ali"
    },
    "group": {
      "id": "120363000000000001@g.us",
      "name": "Block B Residents"
    },
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MessageLog, Ticket, TicketStatus, TicketPriority
from app.schemas import ClassificationResponse
from app.services.ai_classifier import classify_complaint, ClassificationResult
from app.services.group_filter import is_group_allowed, allowed_groups_list
from app.services.openclaw_client import get_openclaw_client
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/openclaw", tags=["OpenClaw"])

CONFIDENCE_THRESHOLD = 0.7

_PRIORITY_MAP = {
    "High": TicketPriority.HIGH,
    "Medium": TicketPriority.MEDIUM,
    "Low": TicketPriority.LOW,
}


# ─── Pydantic models for OpenClaw payload ─────────────────────────────────────

class _Sender(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


class _Group(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


class _MessageData(BaseModel):
    id: Optional[str] = None
    text: Optional[str] = Field(None, description="Message body text")
    from_: Optional[_Sender] = Field(None, alias="from")
    group: Optional[_Group] = None
    timestamp: Optional[str] = None

    model_config = {"populate_by_name": True}


class OpenClawEvent(BaseModel):
    event: str = Field(..., description="Event type, e.g. 'message'")
    data: Optional[_MessageData] = None


# ─── Response schema ───────────────────────────────────────────────────────────

class OpenClawEventResponse(BaseModel):
    status: str
    reason: Optional[str] = None
    ticket_id: Optional[int] = None
    is_complaint: Optional[bool] = None
    classification: Optional[ClassificationResponse] = None
    whatsapp_reply: Optional[str] = None
    reply_sent: Optional[bool] = None


# ─── Handler ──────────────────────────────────────────────────────────────────

@router.post(
    "/events",
    response_model=OpenClawEventResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive an OpenClaw WhatsApp event",
)
async def handle_openclaw_event(
    event: OpenClawEvent,
    db: Session = Depends(get_db),
):
    """
    Main OpenClaw integration endpoint.

    Flow:
      1. Ignore non-message events (delivery receipts, status updates, etc.).
      2. Apply group allow-list filtering.
      3. Extract message text / sender / group metadata.
      4. Run complaint pipeline: log → AI classify → conditionally create ticket.
      5. Send WhatsApp reply back to the originating group via OpenClaw API.
    """

    # ── 1. Event type gate ───────────────────────────────────────────────────
    if event.event != "message":
        logger.debug("OpenClaw: ignoring non-message event '%s'", event.event)
        return OpenClawEventResponse(status="ignored", reason=f"event type '{event.event}' not handled")

    data = event.data
    if not data or not data.text or not data.text.strip():
        return OpenClawEventResponse(status="ignored", reason="empty message body")

    message_text = data.text.strip()
    sender_id = data.from_.id if data.from_ else None
    sender_name = data.from_.name if data.from_ else None
    group_id = data.group.id if data.group else None
    group_name = data.group.name if data.group else None

    # ── 2. Group filter ──────────────────────────────────────────────────────
    if not is_group_allowed(group_id, group_name):
        logger.info(
            "OpenClaw: message from group '%s' (%s) rejected by group filter",
            group_name, group_id,
        )
        return OpenClawEventResponse(
            status="ignored",
            reason=f"group '{group_name or group_id}' is not in the allowed list",
        )

    logger.info(
        "OpenClaw: processing message from %s in group '%s'",
        sender_id, group_name,
    )

    # ── 3. Log raw message ───────────────────────────────────────────────────
    log = MessageLog(
        raw_message=message_text,
        sender=sender_id,
        group_name=group_name,
    )
    db.add(log)
    db.flush()

    # ── 4. Classify ──────────────────────────────────────────────────────────
    try:
        result: ClassificationResult = await classify_complaint(message_text)
    except Exception as exc:
        logger.error("Classification error: %s", exc)
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
        location=result.location,
        confidence=result.confidence,
    )

    # ── 5. Ticket creation ───────────────────────────────────────────────────
    ticket_id: Optional[int] = None
    whatsapp_reply: str

    if result.is_complaint and result.confidence > CONFIDENCE_THRESHOLD:
        priority = _PRIORITY_MAP.get(result.priority, TicketPriority.MEDIUM)
        ticket = Ticket(
            message_text=message_text,
            category=result.category,
            priority=priority,
            location=result.location,
            status=TicketStatus.OPEN,
            reporter_name=sender_name,
            group_name=group_name,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        ticket_id = ticket.id
        whatsapp_reply = generate_whatsapp_reply(ticket)
        logger.info(
            "Ticket #%d created via OpenClaw — category=%s priority=%s confidence=%.2f",
            ticket_id, result.category, result.priority, result.confidence,
        )
    else:
        db.commit()
        whatsapp_reply = generate_ignored_reply()
        if not result.is_complaint:
            logger.info("OpenClaw: non-complaint message ignored — sender=%s", sender_id)
        else:
            logger.info(
                "OpenClaw: low-confidence message ignored (%.2f) — sender=%s",
                result.confidence, sender_id,
            )

    # ── 6. Send reply back to WhatsApp group ─────────────────────────────────
    reply_sent = False
    if group_id:
        client = get_openclaw_client()
        reply_sent = await client.send_message(group_id, whatsapp_reply)
    else:
        logger.warning("OpenClaw: no group_id available — cannot send reply")

    return OpenClawEventResponse(
        status="processed",
        ticket_id=ticket_id,
        is_complaint=result.is_complaint,
        classification=classification,
        whatsapp_reply=whatsapp_reply,
        reply_sent=reply_sent,
    )


# ─── Diagnostics ──────────────────────────────────────────────────────────────

@router.get(
    "/config",
    summary="Show current OpenClaw integration configuration",
    tags=["OpenClaw"],
)
def openclaw_config():
    """
    Returns the active integration settings (no secrets exposed).
    Useful for verifying your environment setup.
    """
    import os
    return {
        "openclaw_api_url": os.getenv("OPENCLAW_API_URL", "https://api.openclaw.io"),
        "api_key_configured": bool(os.getenv("OPENCLAW_API_KEY")),
        "allowed_groups": allowed_groups_list() or ["* (all groups)"],
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }
