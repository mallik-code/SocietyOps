"""
Daily report generator — aggregates ticket data for a given date.
"""
from datetime import date, datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import Ticket, TicketStatus
from app.schemas import DailyReport, CategorySummary


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
        .filter(day_filter, Ticket.status == TicketStatus.OPEN)
        .scalar() or 0
    )
    in_progress = (
        db.query(func.count(Ticket.id))
        .filter(day_filter, Ticket.status == TicketStatus.IN_PROGRESS)
        .scalar() or 0
    )
    resolved = (
        db.query(func.count(Ticket.id))
        .filter(day_filter, Ticket.status == TicketStatus.RESOLVED)
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
        CategorySummary(category=str(row.priority.value if hasattr(row.priority, "value") else row.priority), count=row.cnt)
        for row in by_priority_rows
    ]

    resolved_tickets = (
        db.query(Ticket.created_at, Ticket.updated_at)
        .filter(day_filter, Ticket.status == TicketStatus.RESOLVED)
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
