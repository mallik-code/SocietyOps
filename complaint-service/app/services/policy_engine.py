"""
Policy Engine — central safety and compliance layer.

All processing decisions flow through here. Every rule is:
  - Named (blocked_by field tells you exactly which rule fired)
  - Configurable via environment variable
  - Logged so the audit trail is clear

Environment variables (all optional — defaults are production-safe):
    READ_ONLY_MODE       true/false — if true, no replies or tickets are ever created
    MIN_CONFIDENCE       float 0–1  — minimum AI confidence to create a ticket (default 0.7)
    ALLOW_CASUAL_REPLIES true/false — send a reply even to non-complaints (default false)
    ALLOWED_GROUPS       comma-separated group IDs/names, or * for all (default *)
    ALLOWED_SENDERS      comma-separated sender IDs/phones, or * for all (default *)
    MAX_MESSAGE_LENGTH   max chars to process (default 2000, hard reject above this)
    BLOCK_KEYWORDS       comma-separated words — messages containing any are rejected
"""
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ─── Configuration (loaded once at import time) ────────────────────────────────

def _env_bool(key: str, default: bool) -> bool:
    return os.getenv(key, str(default)).strip().lower() in ("true", "1", "yes")

def _env_set(key: str) -> set[str]:
    raw = os.getenv(key, "*").strip()
    if raw in ("*", ""):
        return set()          # empty = wildcard
    return {v.strip() for v in raw.split(",") if v.strip()}

def _env_float(key: str, default: float) -> float:
    try:
        return float(os.getenv(key, str(default)))
    except ValueError:
        return default

def _env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


class _PolicyConfig:
    """Singleton that reads all policy env vars once at startup."""

    def __init__(self):
        self.read_only         = _env_bool("READ_ONLY_MODE", False)
        self.min_confidence    = _env_float("MIN_CONFIDENCE", 0.7)
        self.allow_casual_replies = _env_bool("ALLOW_CASUAL_REPLIES", False)
        self.max_message_length   = _env_int("MAX_MESSAGE_LENGTH", 2000)

        # Group / sender allow-lists (empty set = wildcard / allow all)
        self.allowed_groups    = _env_set("ALLOWED_GROUPS")
        self.allowed_senders   = _env_set("ALLOWED_SENDERS")

        # Block-list keywords (case-insensitive)
        raw_block = os.getenv("BLOCK_KEYWORDS", "").strip()
        self.block_keywords: list[str] = (
            [kw.strip().lower() for kw in raw_block.split(",") if kw.strip()]
            if raw_block else []
        )

        self._log_config()

    def _log_config(self):
        logger.info(
            "PolicyEngine loaded: read_only=%s min_confidence=%.2f "
            "allow_casual_replies=%s max_len=%d allowed_groups=%s "
            "allowed_senders=%s block_keywords=%d",
            self.read_only,
            self.min_confidence,
            self.allow_casual_replies,
            self.max_message_length,
            "ALL" if not self.allowed_groups else len(self.allowed_groups),
            "ALL" if not self.allowed_senders else len(self.allowed_senders),
            len(self.block_keywords),
        )

    def to_dict(self) -> dict:
        return {
            "read_only_mode":      self.read_only,
            "min_confidence":      self.min_confidence,
            "allow_casual_replies":self.allow_casual_replies,
            "max_message_length":  self.max_message_length,
            "allowed_groups":      sorted(self.allowed_groups) if self.allowed_groups else ["* (all)"],
            "allowed_senders":     sorted(self.allowed_senders) if self.allowed_senders else ["* (all)"],
            "block_keywords_count":len(self.block_keywords),
        }


_config = _PolicyConfig()


# ─── Decision object ───────────────────────────────────────────────────────────

@dataclass
class PolicyDecision:
    allow_processing: bool          # log + classify this message?
    allow_ticket: bool              # create a DB ticket?
    allow_reply: bool               # send a WhatsApp reply?
    blocked_by: Optional[str]       # rule name that blocked, or None
    reason: str                     # human-readable explanation
    violations: list[str] = field(default_factory=list)  # all violated rules


def _block(rule: str, reason: str) -> PolicyDecision:
    logger.info("PolicyEngine BLOCK [%s] — %s", rule, reason)
    return PolicyDecision(
        allow_processing=False,
        allow_ticket=False,
        allow_reply=False,
        blocked_by=rule,
        reason=reason,
        violations=[rule],
    )


def _pass(allow_ticket: bool, allow_reply: bool, reason: str,
          violations: list[str] | None = None) -> PolicyDecision:
    return PolicyDecision(
        allow_processing=True,
        allow_ticket=allow_ticket,
        allow_reply=allow_reply,
        blocked_by=None,
        reason=reason,
        violations=violations or [],
    )


# ─── Individual rule checkers ──────────────────────────────────────────────────

def _check_group(group_id: Optional[str], group_name: Optional[str]) -> Optional[str]:
    """Returns a violation string if the group is not allowed, else None."""
    if not _config.allowed_groups:
        return None  # wildcard
    gid = (group_id or "").strip()
    gname = (group_name or "").strip().lower()
    allowed_lower = {g.lower() for g in _config.allowed_groups}
    if gid in _config.allowed_groups or gname in allowed_lower:
        return None
    return f"GROUP_NOT_ALLOWED: '{group_name or group_id}'"


def _check_sender(sender_id: Optional[str]) -> Optional[str]:
    if not _config.allowed_senders:
        return None
    if (sender_id or "").strip() in _config.allowed_senders:
        return None
    return f"SENDER_NOT_ALLOWED: '{sender_id}'"


def _check_message_length(text: str) -> Optional[str]:
    if len(text) > _config.max_message_length:
        return f"MESSAGE_TOO_LONG: {len(text)} chars > max {_config.max_message_length}"
    return None


def _check_block_keywords(text: str) -> Optional[str]:
    lower = text.lower()
    for kw in _config.block_keywords:
        if re.search(r'\b' + re.escape(kw) + r'\b', lower):
            return f"BLOCKED_KEYWORD: '{kw}'"
    return None


# ─── Public API ────────────────────────────────────────────────────────────────

def evaluate_inbound(
    message_text: str,
    group_id: Optional[str] = None,
    group_name: Optional[str] = None,
    sender_id: Optional[str] = None,
) -> PolicyDecision:
    """
    Phase 1 — evaluate a raw inbound message BEFORE AI classification.
    Checks: group allow-list, sender allow-list, message length, block keywords.

    Returns a PolicyDecision. If allow_processing=False the caller should
    log the message but skip classification and ticket creation entirely.
    """
    violations = []

    v = _check_group(group_id, group_name)
    if v:
        return _block("GROUP_NOT_ALLOWED", v)

    v = _check_sender(sender_id)
    if v:
        return _block("SENDER_NOT_ALLOWED", v)

    v = _check_message_length(message_text)
    if v:
        return _block("MESSAGE_TOO_LONG", v)

    v = _check_block_keywords(message_text)
    if v:
        return _block("BLOCKED_KEYWORD", v)

    # READ_ONLY blocks ticket creation and replies but allows logging + classification
    if _config.read_only:
        violations.append("READ_ONLY_MODE")
        return _pass(
            allow_ticket=False,
            allow_reply=False,
            reason="READ_ONLY_MODE active — message classified but no ticket or reply created",
            violations=violations,
        )

    return _pass(allow_ticket=True, allow_reply=True, reason="all inbound checks passed")


def evaluate_classification(
    is_complaint: bool,
    confidence: float,
    group_id: Optional[str] = None,
) -> PolicyDecision:
    """
    Phase 2 — evaluate AFTER AI classification.
    Checks: is_complaint flag, confidence threshold.

    Returns a PolicyDecision. allow_ticket and allow_reply may differ:
    - Casual message: no ticket, no reply (unless ALLOW_CASUAL_REPLIES=true)
    - Low confidence: no ticket, no reply
    - Valid complaint: both allowed (subject to READ_ONLY)
    """
    violations: list[str] = []

    if _config.read_only:
        violations.append("READ_ONLY_MODE")
        return _pass(
            allow_ticket=False,
            allow_reply=False,
            reason="READ_ONLY_MODE active",
            violations=violations,
        )

    if not is_complaint:
        violations.append("NOT_A_COMPLAINT")
        allow_reply = _config.allow_casual_replies
        return _pass(
            allow_ticket=False,
            allow_reply=allow_reply,
            reason="message classified as non-complaint"
                   + (" — casual reply suppressed" if not allow_reply else " — casual reply allowed"),
            violations=violations,
        )

    if confidence <= _config.min_confidence:
        violations.append(f"LOW_CONFIDENCE({confidence:.2f}<={_config.min_confidence})")
        return _pass(
            allow_ticket=False,
            allow_reply=False,
            reason=f"confidence {confidence:.2f} does not meet threshold {_config.min_confidence}",
            violations=violations,
        )

    return _pass(
        allow_ticket=True,
        allow_reply=True,
        reason=f"complaint confirmed — confidence {confidence:.2f} >= {_config.min_confidence}",
    )


def reply_allowed() -> bool:
    """Quick check: is sending any reply currently allowed?"""
    return not _config.read_only


def get_policy_config() -> dict:
    """Return the active policy configuration (safe to expose via API)."""
    return _config.to_dict()


def get_min_confidence() -> float:
    return _config.min_confidence
