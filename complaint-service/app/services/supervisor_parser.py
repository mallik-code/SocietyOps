"""
Supervisor reply parser.

Understands short-form commands that supervisors type in WhatsApp:
    "123 resolved"
    "123 started"
    "123 delayed"

Also accepts variations:
    "#123 resolved", "ticket 123 resolved", "id 123 resolved"
    Action words are matched case-insensitively and support common aliases.
"""
import re
import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Ticket, SupervisorAction, TicketStatus, SupervisorActionType

logger = logging.getLogger(__name__)

# ─── Action aliases ────────────────────────────────────────────────────────────

_ACTION_MAP: dict[str, SupervisorActionType] = {
    # STARTED
    "started":    SupervisorActionType.STARTED,
    "start":      SupervisorActionType.STARTED,
    "begin":      SupervisorActionType.STARTED,
    "inprogress": SupervisorActionType.STARTED,
    "in_progress":SupervisorActionType.STARTED,
    "wip":        SupervisorActionType.STARTED,
    # RESOLVED
    "resolved":   SupervisorActionType.RESOLVED,
    "resolve":    SupervisorActionType.RESOLVED,
    "done":       SupervisorActionType.RESOLVED,
    "fixed":      SupervisorActionType.RESOLVED,
    "complete":   SupervisorActionType.RESOLVED,
    "completed":  SupervisorActionType.RESOLVED,
    "closed":     SupervisorActionType.RESOLVED,
    "close":      SupervisorActionType.RESOLVED,
    # DELAYED
    "delayed":    SupervisorActionType.DELAYED,
    "delay":      SupervisorActionType.DELAYED,
    "postponed":  SupervisorActionType.DELAYED,
    "postpone":   SupervisorActionType.DELAYED,
    "pending":    SupervisorActionType.DELAYED,
    "hold":       SupervisorActionType.DELAYED,
    "onhold":     SupervisorActionType.DELAYED,
}

# Status transitions triggered by each action
_STATUS_MAP: dict[SupervisorActionType, TicketStatus] = {
    SupervisorActionType.STARTED:  TicketStatus.IN_PROGRESS,
    SupervisorActionType.RESOLVED: TicketStatus.RESOLVED,
    SupervisorActionType.DELAYED:  TicketStatus.IN_PROGRESS,  # still being handled
}

# Regex: optional prefix (ticket / # / id) + digits + action word
_COMMAND_RE = re.compile(
    r"(?:ticket\s*|#|id\s*)?(\d+)\s+([a-z_]+)",
    re.IGNORECASE,
)


# ─── Result ────────────────────────────────────────────────────────────────────

@dataclass
class ParsedCommand:
    ticket_id: int
    action: SupervisorActionType


@dataclass
class SupervisorReplyResult:
    success: bool
    ticket_id: Optional[int]
    action: Optional[SupervisorActionType]
    new_status: Optional[TicketStatus]
    confirmation: str          # ready-to-send WhatsApp reply


# ─── Parser ────────────────────────────────────────────────────────────────────

def parse_supervisor_command(text: str) -> Optional[ParsedCommand]:
    """
    Parse a free-text supervisor message into a (ticket_id, action) pair.
    Returns None if the message does not match the expected pattern.
    """
    text = text.strip()
    match = _COMMAND_RE.search(text)
    if not match:
        return None

    raw_id, raw_action = match.group(1), match.group(2).lower().replace("-", "_")

    action = _ACTION_MAP.get(raw_action)
    if action is None:
        logger.debug("Unknown action word '%s' — not a supervisor command", raw_action)
        return None

    return ParsedCommand(ticket_id=int(raw_id), action=action)


def is_supervisor_command(text: str) -> bool:
    """Quick pre-check without building the full ParsedCommand."""
    return parse_supervisor_command(text) is not None


# ─── Processor ─────────────────────────────────────────────────────────────────

def process_supervisor_reply(text: str, db: Session) -> SupervisorReplyResult:
    """
    Parse the supervisor message, update the ticket, log the action,
    and return a SupervisorReplyResult with a ready-to-send confirmation string.
    """
    cmd = parse_supervisor_command(text)

    if cmd is None:
        return SupervisorReplyResult(
            success=False,
            ticket_id=None,
            action=None,
            new_status=None,
            confirmation=(
                "⚠️ Command not recognised.\n"
                "Use format: <ticket_id> <action>\n"
                "Example: 123 resolved | 123 started | 123 delayed"
            ),
        )

    ticket = db.get(Ticket, cmd.ticket_id)
    if ticket is None:
        return SupervisorReplyResult(
            success=False,
            ticket_id=cmd.ticket_id,
            action=cmd.action,
            new_status=None,
            confirmation=f"❌ Ticket #{cmd.ticket_id} not found.",
        )

    # Log the supervisor action
    action_record = SupervisorAction(ticket_id=cmd.ticket_id, action=cmd.action)
    db.add(action_record)

    # Update ticket status
    new_status = _STATUS_MAP[cmd.action]
    ticket.status = new_status
    db.commit()
    db.refresh(ticket)

    logger.info(
        "Supervisor action: ticket=#%d action=%s new_status=%s",
        cmd.ticket_id, cmd.action.value, new_status.value,
    )

    confirmation = _build_confirmation(ticket, cmd.action, new_status)

    return SupervisorReplyResult(
        success=True,
        ticket_id=cmd.ticket_id,
        action=cmd.action,
        new_status=new_status,
        confirmation=confirmation,
    )


def _build_confirmation(ticket: Ticket, action: SupervisorActionType, new_status: TicketStatus) -> str:
    action_label = {
        SupervisorActionType.STARTED:  "🔧 Work Started",
        SupervisorActionType.RESOLVED: "✅ Resolved",
        SupervisorActionType.DELAYED:  "⏳ Delayed",
    }[action]

    location_line = f"Location: {ticket.location}" if ticket.location else ""
    lines = [
        f"{action_label} — Ticket #{ticket.id}",
        f"Category: {ticket.category or 'Other'}",
        f"Priority: {ticket.priority.value if hasattr(ticket.priority, 'value') else ticket.priority}",
    ]
    if location_line:
        lines.append(location_line)
    lines.append(f"Status updated to: {new_status.value}")

    return "\n".join(lines)
