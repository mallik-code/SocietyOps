"""
Daily report generator — aggregates ticket data for a given date and
produces both a structured DailyReport object and a WhatsApp-ready
formatted text string.
"""
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models import Ticket, TicketStatus
from app.schemas import DailyReport, CategorySummary


# ─── Data aggregation ──────────────────────────────────────────────────────────

def generate_daily_report(db: Session, report_date: Optional[date] = None) -> DailyReport:
    if report_date is None:
        report_date = datetime.now(timezone.utc).date()

    day_start = datetime(report_date.year, report_date.month, report_date.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    day_filter = and_(
        Ticket.created_at >= day_start,
        Ticket.created_at < day_end,
    )

    total = db.query(func.count(Ticket.id)).filter(day_filter).scalar() or 0
    open_count = (
        db.query(func.count(Ticket.id))
        .filter(day_filter, Ticket.status == TicketStatus.open)
        .scalar() or 0
    )
    in_progress = (
        db.query(func.count(Ticket.id))
        .filter(day_filter, Ticket.status == TicketStatus.in_progress)
        .scalar() or 0
    )
    resolved = (
        db.query(func.count(Ticket.id))
        .filter(day_filter, Ticket.status == TicketStatus.resolved)
        .scalar() or 0
    )

    by_category_rows = (
        db.query(Ticket.category, func.count(Ticket.id).label("cnt"))
        .filter(day_filter)
        .group_by(Ticket.category)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    by_category = [
        CategorySummary(category=row.category or "Uncategorised", count=row.cnt)
        for row in by_category_rows
    ]

    by_priority_rows = (
        db.query(Ticket.priority, func.count(Ticket.id).label("cnt"))
        .filter(day_filter)
        .group_by(Ticket.priority)
        .order_by(func.count(Ticket.id).desc())
        .all()
    )
    by_priority = [
        CategorySummary(
            category=str(row.priority.value if hasattr(row.priority, "value") else row.priority),
            count=row.cnt,
        )
        for row in by_priority_rows
    ]

    resolved_tickets = (
        db.query(Ticket.created_at, Ticket.updated_at)
        .filter(day_filter, Ticket.status == TicketStatus.resolved)
        .all()
    )
    avg_hours: Optional[float] = None
    if resolved_tickets:
        durations = []
        for t in resolved_tickets:
            created = t.created_at
            updated = t.updated_at
            if created and updated:
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                durations.append((updated - created).total_seconds() / 3600)
        if durations:
            avg_hours = round(sum(durations) / len(durations), 2)

    return DailyReport(
        date=report_date.isoformat(),
        total_tickets=total,
        open_tickets=open_count,
        in_progress_tickets=in_progress,
        resolved_tickets=resolved,
        by_category=by_category,
        by_priority=by_priority,
        avg_resolution_time_hours=avg_hours,
    )


# ─── Oldest pending issues ─────────────────────────────────────────────────────

def _get_oldest_pending(db: Session, limit: int = 5) -> list[Ticket]:
    """Return the oldest tickets still in OPEN or IN_PROGRESS state."""
    return (
        db.query(Ticket)
        .filter(Ticket.status.in_([TicketStatus.open, TicketStatus.in_progress]))
        .order_by(Ticket.created_at.asc())
        .limit(limit)
        .all()
    )


def _age_label(ticket: Ticket) -> str:
    """Human-readable age string for a ticket."""
    created = ticket.created_at
    if created is None:
        return "unknown age"
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - created
    days = delta.days
    hours = delta.seconds // 3600
    if days > 0:
        return f"{days}d {hours}h ago"
    if hours > 0:
        return f"{hours}h ago"
    return "just now"


# ─── Text formatter ────────────────────────────────────────────────────────────

def format_daily_report_text(db: Session, report_date: Optional[date] = None) -> str:
    """
    Generate a WhatsApp-ready plain-text daily report.

    Example output:
        📊 Daily Report — 2025-01-15

        Total: 12
        ✅ Resolved: 7
        ⏳ Pending: 5

        📂 Top Issues:
        - Garbage: 4
        - Lift: 3
        - Water: 2
        - Electrical: 2
        - Other: 1

        🕐 Oldest Pending:
        #3 — Road (HIGH) — 2d 4h ago
        #7 — Water (CRITICAL) — 1d 12h ago
        #11 — Lift (MEDIUM) — 6h ago

        ⚡ Avg resolution time: 3.5h
    """
    report = generate_daily_report(db, report_date)
    pending = report.open_tickets + report.in_progress_tickets
    oldest = _get_oldest_pending(db)

    lines: list[str] = []

    # ── Header ────────────────────────────────────────────────────────────────
    lines.append(f"📊 *Daily Report — {report.date}*")
    lines.append("")

    # ── Summary counts ────────────────────────────────────────────────────────
    lines.append(f"Total: {report.total_tickets}")
    lines.append(f"✅ Resolved: {report.resolved_tickets}")
    lines.append(f"⏳ Pending: {pending}")
    if report.in_progress_tickets:
        lines.append(f"🔧 In Progress: {report.in_progress_tickets}")

    # ── By category ───────────────────────────────────────────────────────────
    if report.by_category:
        lines.append("")
        lines.append("📂 *Top Issues:*")
        for item in report.by_category:
            lines.append(f"  - {item.category}: {item.count}")

    # ── Oldest pending ────────────────────────────────────────────────────────
    if oldest:
        lines.append("")
        lines.append("🕐 *Oldest Pending:*")
        for ticket in oldest:
            priority_val = (
                ticket.priority.value
                if hasattr(ticket.priority, "value")
                else str(ticket.priority)
            )
            category = ticket.category or "Other"
            age = _age_label(ticket)
            location = f" — {ticket.location}" if ticket.location else ""
            lines.append(f"  #{ticket.id} — {category} ({priority_val}){location} — {age}")

    # ── Avg resolution time ───────────────────────────────────────────────────
    if report.avg_resolution_time_hours is not None:
        lines.append("")
        lines.append(f"⚡ Avg resolution time: {report.avg_resolution_time_hours}h")

    return "\n".join(lines)
