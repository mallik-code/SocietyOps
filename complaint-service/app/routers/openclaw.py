"""
OpenClaw webhook handler.

OpenClaw calls POST /openclaw/events for every WhatsApp message event.

Flow:
  1. Ignore non-message events.
  2. Extract text / sender / group.
  3. Policy Engine — Phase 1 (inbound): group filter, sender filter, length, keywords.
  4. Log raw message.
  5. Supervisor command detection (bypasses AI and policy Phase 2).
  6. AI classification.
  7. Policy Engine — Phase 2 (post-classification): complaint check, confidence threshold.
  8. Conditionally create ticket.
  9. Conditionally send WhatsApp reply (suppressed in READ_ONLY mode).

Expected OpenClaw webhook payload shape:
{
  "event": "message",
  "data": {
    "id": "msg_abc123",
    "text": "The lift on 3rd floor is broken urgently",
    "from": { "id": "923001234567@s.whatsapp.net", "name": "Ahmed Ali" },
    "group": { "id": "120363000000000001@g.us", "name": "Block B Residents" },
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MessageLog, Ticket, TicketStatus, TicketPriority
from app.schemas import ClassificationResponse
from app.services.ai_classifier import classify_complaint, ClassificationResult
from app.services.openclaw_client import get_openclaw_client
from app.services.policy_engine import (
    evaluate_inbound,
    evaluate_classification,
    get_policy_config,
    get_min_confidence,
)
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply
from app.services.supervisor_parser import is_supervisor_command, process_supervisor_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/openclaw", tags=["OpenClaw"])

_PRIORITY_MAP = {
    "High": TicketPriority.HIGH,
    "Medium": TicketPriority.MEDIUM,
    "Low": TicketPriority.LOW,
}


# ─── Pydantic models ───────────────────────────────────────────────────────────

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


class OpenClawEventResponse(BaseModel):
    status: str
    reason: Optional[str] = None
    policy_violations: list[str] = []
    ticket_id: Optional[int] = None
    is_complaint: Optional[bool] = None
    classification: Optional[ClassificationResponse] = None
    whatsapp_reply: Optional[str] = None
    reply_sent: Optional[bool] = None


# ─── Main handler ──────────────────────────────────────────────────────────────

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
    # ── 1. Event type gate ────────────────────────────────────────────────────
    if event.event != "message":
        return OpenClawEventResponse(
            status="ignored",
            reason=f"event type '{event.event}' not handled",
        )

    data = event.data
    if not data or not data.text or not data.text.strip():
        return OpenClawEventResponse(status="ignored", reason="empty message body")

    message_text = data.text.strip()
    sender_id    = data.from_.id   if data.from_ else None
    sender_name  = data.from_.name if data.from_ else None
    group_id     = data.group.id   if data.group else None
    group_name   = data.group.name if data.group else None

    # ── 2. Policy Phase 1 — inbound checks ───────────────────────────────────
    inbound_decision = evaluate_inbound(
        message_text=message_text,
        group_id=group_id,
        group_name=group_name,
        sender_id=sender_id,
    )
    if not inbound_decision.allow_processing:
        return OpenClawEventResponse(
            status="blocked",
            reason=inbound_decision.reason,
            policy_violations=inbound_decision.violations,
        )

    logger.info("OpenClaw: processing message from %s in group '%s'", sender_id, group_name)

    # ── 3. Log raw message ────────────────────────────────────────────────────
    db.add(MessageLog(raw_message=message_text, sender=sender_id, group_name=group_name))
    db.flush()

    # ── 4. Supervisor command (bypasses AI + policy Phase 2) ─────────────────
    if is_supervisor_command(message_text):
        logger.info("OpenClaw: supervisor command from %s", sender_id)
        sv = process_supervisor_reply(message_text, db)
        reply_sent = False
        if group_id and inbound_decision.allow_reply:
            reply_sent = await get_openclaw_client().send_message(group_id, sv.confirmation)
        return OpenClawEventResponse(
            status="supervisor_action",
            ticket_id=sv.ticket_id,
            whatsapp_reply=sv.confirmation,
            reply_sent=reply_sent,
            reason=f"action={sv.action.value if sv.action else None} success={sv.success}",
            policy_violations=inbound_decision.violations,
        )

    # ── 5. AI classification ──────────────────────────────────────────────────
    try:
        result: ClassificationResult = await classify_complaint(message_text)
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
        location=result.location,
        confidence=result.confidence,
    )

    # ── 6. Policy Phase 2 — post-classification checks ───────────────────────
    post_decision = evaluate_classification(
        is_complaint=result.is_complaint,
        confidence=result.confidence,
        group_id=group_id,
    )
    all_violations = inbound_decision.violations + post_decision.violations

    # ── 7. Ticket creation ────────────────────────────────────────────────────
    ticket_id: Optional[int] = None
    whatsapp_reply: str

    if post_decision.allow_ticket:
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
            "Ticket #%d created — category=%s priority=%s confidence=%.2f",
            ticket_id, result.category, result.priority, result.confidence,
        )
    else:
        db.commit()
        whatsapp_reply = generate_ignored_reply() if result.is_complaint else ""
        logger.info(
            "Ticket skipped — %s — sender=%s", post_decision.reason, sender_id
        )

    # ── 8. Send reply ─────────────────────────────────────────────────────────
    reply_sent = False
    can_reply = post_decision.allow_reply and bool(whatsapp_reply)

    if can_reply and group_id:
        reply_sent = await get_openclaw_client().send_message(group_id, whatsapp_reply)
    elif not can_reply:
        logger.info("Reply suppressed — policy: %s", post_decision.reason)

    return OpenClawEventResponse(
        status="processed",
        reason=post_decision.reason,
        policy_violations=all_violations,
        ticket_id=ticket_id,
        is_complaint=result.is_complaint,
        classification=classification,
        whatsapp_reply=whatsapp_reply or None,
        reply_sent=reply_sent,
    )


# ─── Config / diagnostics ─────────────────────────────────────────────────────

@router.get("/config", summary="Show OpenClaw + policy configuration")
def openclaw_config():
    import os
    return {
        "openclaw_api_url":   os.getenv("OPENCLAW_API_URL", "https://api.openclaw.io"),
        "api_key_configured": bool(os.getenv("OPENCLAW_API_KEY")),
        "policy":             get_policy_config(),
    }
