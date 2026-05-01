"""
Auto-response generator — formats a WhatsApp reply from a ticket object.
"""
from app.models import Ticket


def generate_whatsapp_reply(ticket: Ticket) -> str:
    """
    Returns a formatted WhatsApp reply string for the given ticket.

    Example output:
        ✅ Ticket #123 created
        Category: Lift
        Priority: High
        Location: Block B
        Status: OPEN
    """
    location_line = f"Location: {ticket.location}" if ticket.location else "Location: Not specified"
    priority = ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
    status = ticket.status.value if hasattr(ticket.status, "value") else str(ticket.status)

    return (
        f"✅ Ticket #{ticket.id} created\n"
        f"Category: {ticket.category or 'Other'}\n"
        f"Priority: {priority}\n"
        f"{location_line}\n"
        f"Status: {status}"
    )


def generate_ignored_reply() -> str:
    """
    Returns a polite reply when the message is not classified as a complaint.
    """
    return "ℹ️ Your message was received but does not appear to be a complaint. Please describe your issue clearly and we'll create a ticket for you."
