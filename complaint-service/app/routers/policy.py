"""
Policy inspection endpoint — read-only view of the active policy configuration.
"""
import os
from fastapi import APIRouter
from app.services.policy_engine import get_policy_config, evaluate_inbound, evaluate_classification
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/policy", tags=["Policy"])


@router.get(
    "/",
    summary="Show the active policy engine configuration",
)
def policy_status():
    """
    Returns all active policy rules and their current values.
    No secrets are exposed — only operational config.
    """
    cfg = get_policy_config()
    return {
        "policy": cfg,
        "env_vars": {
            "READ_ONLY_MODE":       os.getenv("READ_ONLY_MODE", "false"),
            "MIN_CONFIDENCE":       os.getenv("MIN_CONFIDENCE", "0.7"),
            "ALLOW_CASUAL_REPLIES": os.getenv("ALLOW_CASUAL_REPLIES", "false"),
            "MAX_MESSAGE_LENGTH":   os.getenv("MAX_MESSAGE_LENGTH", "2000"),
            "ALLOWED_GROUPS":       os.getenv("ALLOWED_GROUPS", "*"),
            "ALLOWED_SENDERS":      os.getenv("ALLOWED_SENDERS", "*"),
            "BLOCK_KEYWORDS":       os.getenv("BLOCK_KEYWORDS", ""),
        },
    }


class _SimulateRequest(BaseModel):
    message_text: str
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    sender_id: Optional[str] = None
    is_complaint: Optional[bool] = True
    confidence: Optional[float] = 0.85


@router.post(
    "/simulate",
    summary="Simulate a policy decision without processing a real message",
)
def simulate_policy(payload: _SimulateRequest):
    """
    Dry-run the full policy pipeline against a hypothetical message.
    Useful for testing configuration changes before going live.
    """
    inbound = evaluate_inbound(
        message_text=payload.message_text,
        group_id=payload.group_id,
        group_name=payload.group_name,
        sender_id=payload.sender_id,
    )

    post = None
    if inbound.allow_processing:
        post = evaluate_classification(
            is_complaint=payload.is_complaint if payload.is_complaint is not None else True,
            confidence=payload.confidence if payload.confidence is not None else 0.85,
        )

    return {
        "inbound_check": {
            "allow_processing": inbound.allow_processing,
            "blocked_by":       inbound.blocked_by,
            "reason":           inbound.reason,
            "violations":       inbound.violations,
        },
        "post_classification_check": {
            "allow_ticket":  post.allow_ticket  if post else None,
            "allow_reply":   post.allow_reply   if post else None,
            "blocked_by":    post.blocked_by    if post else None,
            "reason":        post.reason        if post else "skipped (inbound blocked)",
            "violations":    post.violations    if post else [],
        } if post is not None else "skipped — inbound check failed",
        "final_outcome": {
            "will_log":            inbound.allow_processing,
            "will_create_ticket":  (post.allow_ticket  if post else False),
            "will_send_reply":     (post.allow_reply   if post else False),
        },
    }
