"""
Evolution API webhook handler.

Evolution API calls POST /evolution/events for every WhatsApp event it
receives on the linked instance.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ClassificationResponse
from app.services.evolution_client import get_evolution_client
from app.services.message_orchestrator import MessageOrchestrator
from app.services.policy_engine import get_policy_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/evolution", tags=["Evolution API"])


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
    matched_ticket_id: Optional[int]  = None
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
    Delegates orchestration to MessageOrchestrator.
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
    reply_to = group_jid or sender_jid  # where to send the reply

    # ── Orchestration ─────────────────────────────────────────────────────────
    orchestrator = MessageOrchestrator(db)
    result = await orchestrator.process_message(
        message_text=message_text,
        sender_jid=sender_jid,
        sender_name=sender_name,
        group_jid=group_jid,
    )

    # ── Response formatting ───────────────────────────────────────────────────
    reply_sent = False
    if result.whatsapp_reply:
        reply_sent = await get_evolution_client().send_message(reply_to, result.whatsapp_reply)

    classification_resp = None
    if result.classification:
        classification_resp = ClassificationResponse(
            is_complaint=result.classification.is_complaint,
            intent=result.classification.intent,
            category=result.classification.category,
            priority=result.classification.priority,
            location=result.classification.location,
            issue_summary=result.classification.issue_summary,
            confidence=result.classification.confidence,
        )

    return EvolutionEventResponse(
        status=result.status,
        reason=result.reason,
        policy_violations=result.violations,
        ticket_id=result.ticket_id,
        matched_ticket_id=result.matched_ticket_id,
        is_complaint=result.classification.is_complaint if result.classification else None,
        classification=classification_resp,
        whatsapp_reply=result.whatsapp_reply,
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
