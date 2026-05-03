"""
Evolution API webhook handler.

Evolution API calls POST /evolution/events for every WhatsApp event it
receives on the linked instance.

Supported event: messages.upsert
All other events (connection updates, read receipts, etc.) are acknowledged
with status="ignored" so Evolution API does not retry them.

Evolution API v2 payload shape (group message):
{
  "event": "messages.upsert",
  "instance": "complaint-bot",
  "data": {
    "key": {
      "remoteJid": "120363000000000001@g.us",   <- group JID
      "fromMe": false,
      "id": "3EB0ABC123XYZ",
      "participant": "923001234567@s.whatsapp.net"  <- actual sender (groups only)
    },
    "pushName": "Ahmed Ali",
    "messageType": "conversation",
    "message": {
      "conversation": "The lift on 3rd floor is broken urgently"
      // or: "extendedTextMessage": {"text": "..."}
    },
    "messageTimestamp": 1705312345
  }
}

Direct message (no group):
  remoteJid = "923001234567@s.whatsapp.net"
  participant is absent / null
"""
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MessageLog, Ticket, TicketStatus, TicketPriority
from app.schemas import ClassificationResponse
from app.services.ai_classifier import classify_complaint, ClassificationResult
from app.services.evolution_client import get_evolution_client
from app.services.policy_engine import (
    evaluate_inbound,
    evaluate_classification,
    get_policy_config,
    get_min_confidence,
)
from app.services.response_generator import generate_whatsapp_reply, generate_ignored_reply
from app.services.supervisor_parser import is_supervisor_command, process_supervisor_reply

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/evolution", tags=["Evolution API"])

_PRIORITY_MAP = {
    "high":     TicketPriority.High,
    "medium":   TicketPriority.Medium,
    "low":      TicketPriority.Low,
    "critical": TicketPriority.Critical,
}


# ─── Pydantic models for Evolution API v2 payload ─────────────────────────────

class _Key(BaseModel):
    remoteJid:   Optional[str] = None   # group JID or sender JID
    fromMe:      Optional[bool] = False
    id:          Optional[str] = None
    participant: Optional[str] = None   # actual sender in group messages


class _TextMessage(BaseModel):
    text: Optional[str] = None


class _Message(BaseModel):
    conversation:        Optional[str] = None
    extendedTextMessage: Optional[_TextMessage] = None


class _EventData(BaseModel):
    key:              Optional[_Key]     = None
    pushName:         Optional[str]      = None     # sender's display name
    messageType:      Optional[str]      = None
    message:          Optional[_Message] = None
    messageTimestamp: Optional[int]      = None


class EvolutionEvent(BaseModel):
    event:    str = Field(..., description="Event name, e.g. messages.upsert")
    instance: Optional[str]      = None
    data:     Optional[_EventData] = None


class EvolutionEventResponse(BaseModel):
    status:            str
    reason:            Optional[str]  = None
    policy_violations: list[str]      = []
    ticket_id:         Optional[int]  = None
    is_complaint:      Optional[bool] = None
    classification:    Optional[ClassificationResponse] = None
    whatsapp_reply:    Optional[str]  = None
    reply_sent:        Optional[bool] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_text(msg: Optional[_Message]) -> Optional[str]:
    """Pull message text out of the nested Evolution message structure."""
    if msg is None:
        return None
    if msg.conversation:
        return msg.conversation.strip()
    if msg.extendedTextMessage and msg.extendedTextMessage.text:
        return msg.extendedTextMessage.text.strip()
    return None


def _is_group(jid: Optional[str]) -> bool:
    return bool(jid and jid.endswith("@g.us"))


# ─── Main handler ──────────────────────────────────────────────────────────────

@router.post(
    "/events",
    response_model=EvolutionEventResponse,
    status_code=status.HTTP_200_OK,
    summary="Receive an Evolution API WhatsApp event",
)
async def handle_evolution_event(
    event: EvolutionEvent,
    db: Session = Depends(get_db),
):
    """
    Main Evolution API webhook endpoint.

    Flow:
      1.  Only handle messages.upsert — ignore everything else.
      2.  Skip messages sent by the bot itself (fromMe=true).
      3.  Extract text, sender JID, group JID, and display name.
      4.  Policy Engine Phase 1 — inbound checks.
      5.  Log raw message to DB.
      6.  Supervisor command detection.
      7.  AI classification.
      8.  Policy Engine Phase 2 — post-classification checks.
      9.  Conditionally create ticket.
      10. Conditionally send WhatsApp reply via Evolution API.
    """

    # ── 1. Event type gate ────────────────────────────────────────────────────
    event_type = event.event
    if event_type != "messages.upsert" and event_type != "MESSAGES_UPSERT":
        return EvolutionEventResponse(
            status="ignored",
            reason=f"event '{event_type}' not handled",
        )

    data = event.data
    if not data or not data.key:
        return EvolutionEventResponse(status="ignored", reason="missing event data")

    # ── 2. Skip own messages ──────────────────────────────────────────────────
    if data.key.fromMe:
        return EvolutionEventResponse(status="ignored", reason="own message skipped")

    # ── 3. Extract fields ─────────────────────────────────────────────────────
    message_text = _extract_text(data.message)
    if not message_text:
        return EvolutionEventResponse(status="ignored", reason="no text content")

    remote_jid  = data.key.remoteJid    # group JID or contact JID
    sender_jid  = data.key.participant or remote_jid   # actual human sender
    sender_name = data.pushName

    # For group messages: reply to the group. For DMs: reply to the sender.
    group_jid  = remote_jid if _is_group(remote_jid) else None
    group_name = None   # Evolution API doesn't include group name in the event;
                        # we use the JID as the identifier

    reply_to = group_jid or sender_jid  # where to send the reply

    # ── 4. Policy Phase 1 ─────────────────────────────────────────────────────
    inbound = evaluate_inbound(
        message_text=message_text,
        group_id=group_jid,
        group_name=group_name,
        sender_id=sender_jid,
    )
    if not inbound.allow_processing:
        logger.info(
            "Evolution: message blocked [%s] from %s — %s",
            inbound.blocked_by, sender_jid, inbound.reason,
        )
        return EvolutionEventResponse(
            status="blocked",
            reason=inbound.reason,
            policy_violations=inbound.violations,
        )

    logger.info(
        "Evolution: processing message from %s (group=%s)",
        sender_jid, group_jid or "DM",
    )

    # ── 5. Log raw message ────────────────────────────────────────────────────
    db.add(MessageLog(
        raw_message=message_text,
        sender=sender_jid,
        group_name=group_jid or sender_jid,
    ))
    db.flush()

    # ── 6. Supervisor command ─────────────────────────────────────────────────
    if is_supervisor_command(message_text):
        logger.info("Evolution: supervisor command from %s", sender_jid)
        sv = process_supervisor_reply(message_text, db)
        reply_sent = False
        if inbound.allow_reply:
            reply_sent = await get_evolution_client().send_message(reply_to, sv.confirmation)
        return EvolutionEventResponse(
            status="supervisor_action",
            ticket_id=sv.ticket_id,
            whatsapp_reply=sv.confirmation,
            reply_sent=reply_sent,
            reason=f"action={sv.action.value if sv.action else None} success={sv.success}",
            policy_violations=inbound.violations,
        )

    # ── 7. AI classification ──────────────────────────────────────────────────
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

    # ── 8. Policy Phase 2 ─────────────────────────────────────────────────────
    post = evaluate_classification(
        is_complaint=result.is_complaint,
        confidence=result.confidence,
        group_id=group_jid,
    )
    all_violations = inbound.violations + post.violations

    # ── 9. Ticket creation ────────────────────────────────────────────────────
    ticket_id: Optional[int] = None
    whatsapp_reply: str = ""

    if post.allow_ticket:
        priority_key = result.priority.lower() if result.priority else "medium"
        priority = _PRIORITY_MAP.get(priority_key, TicketPriority.Medium)
        ticket = Ticket(
            message_text=message_text,
            category=result.category,
            priority=priority,
            location=result.location,
            status=TicketStatus.open,
            reporter_name=sender_name,
            group_name=group_jid or sender_jid,
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
        if result.is_complaint:
            whatsapp_reply = generate_ignored_reply()
        logger.info("Ticket skipped — %s", post.reason)

    # ── 10. Send reply ────────────────────────────────────────────────────────
    reply_sent = False
    if post.allow_reply and whatsapp_reply:
        reply_sent = await get_evolution_client().send_message(reply_to, whatsapp_reply)
    elif not post.allow_reply:
        logger.info("Reply suppressed — %s", post.reason)

    return EvolutionEventResponse(
        status="processed",
        reason=post.reason,
        policy_violations=all_violations,
        ticket_id=ticket_id,
        is_complaint=result.is_complaint,
        classification=classification,
        whatsapp_reply=whatsapp_reply or None,
        reply_sent=reply_sent,
    )


# ─── Status / diagnostics ─────────────────────────────────────────────────────

@router.get("/status", summary="Check Evolution API instance connection status")
async def evolution_status():
    """
    Returns the WhatsApp connection state of the configured Evolution API instance.
    Use this to confirm the QR code has been scanned and the bot is connected.
    """
    client = get_evolution_client()
    state  = await client.instance_status()
    return {
        "instance": client._instance,
        "api_url":  client._base,
        "connection_state": state,
    }


@router.get("/qr", summary="Fetch the QR code for WhatsApp linking")
async def get_qr_code():
    """
    Returns the base64 QR code image for the configured instance.
    Scan this with WhatsApp to link the bot's number.
    Returns null if the instance is already connected.
    """
    client = get_evolution_client()
    qr     = await client.get_qr_code()
    if qr:
        return {"qr_code_base64": qr, "hint": "Scan this QR code in WhatsApp → Linked Devices"}
    return {"qr_code_base64": None, "hint": "Instance may already be connected — check /evolution/status"}


@router.get("/config", summary="Show active Evolution API configuration")
def evolution_config():
    import os
    return {
        "evolution_api_url":  os.getenv("EVOLUTION_API_URL", "http://evolution:8080"),
        "evolution_instance": os.getenv("EVOLUTION_INSTANCE", "complaint-bot"),
        "api_key_configured": bool(os.getenv("EVOLUTION_API_KEY")),
        "policy":             get_policy_config(),
    }
