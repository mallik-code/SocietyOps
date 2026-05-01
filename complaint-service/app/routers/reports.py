"""
Reporting endpoints — daily summaries and aggregations.
"""
import os
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import DailyReport
from app.services.report_generator import generate_daily_report, format_daily_report_text
from app.services.openclaw_client import get_openclaw_client
from app.services.scheduler import get_scheduler

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily", response_model=DailyReport, summary="Generate a daily complaint report (JSON)")
def daily_report(
    report_date: Optional[date] = Query(
        None,
        description="Date in YYYY-MM-DD format (defaults to today UTC)",
        example="2025-01-15",
    ),
    db: Session = Depends(get_db),
):
    """
    Returns aggregate statistics for all tickets created on the given date,
    including counts by status, category, priority, and average resolution time.
    """
    return generate_daily_report(db, report_date)


@router.get(
    "/daily/text",
    response_class=PlainTextResponse,
    summary="Generate a daily complaint report (WhatsApp-formatted text)",
)
def daily_report_text(
    report_date: Optional[date] = Query(
        None,
        description="Date in YYYY-MM-DD format (defaults to today UTC)",
        example="2025-01-15",
    ),
    db: Session = Depends(get_db),
):
    """
    Returns the same daily report as a WhatsApp-ready plain-text string.
    Includes total/resolved/pending counts, top issues by category,
    oldest unresolved tickets, and average resolution time.

    This string can be forwarded directly to a WhatsApp group via the
    OpenClaw send message API.
    """
    return format_daily_report_text(db, report_date)


@router.post(
    "/daily/send",
    summary="Manually trigger the daily report and send it to the configured group",
)
async def send_daily_report_now(
    report_date: Optional[date] = Query(
        None,
        description="Date in YYYY-MM-DD format (defaults to today UTC)",
    ),
    db: Session = Depends(get_db),
):
    """
    Generates the daily report and immediately sends it to REPORT_GROUP_ID
    via OpenClaw — useful for testing the scheduler or ad-hoc sends.
    """
    group_id = os.getenv("REPORT_GROUP_ID", "")
    if not group_id:
        raise HTTPException(
            status_code=400,
            detail="REPORT_GROUP_ID is not configured. Set it in your .env file.",
        )

    report_text = format_daily_report_text(db, report_date)
    client = get_openclaw_client()
    sent = await client.send_message(group_id, report_text)

    return {
        "sent": sent,
        "group_id": group_id,
        "report_date": (report_date or date.today()).isoformat(),
        "preview": report_text,
    }


@router.get(
    "/scheduler/status",
    summary="Check the daily report scheduler status and next run time",
)
def scheduler_status():
    """
    Returns whether the scheduler is running and when the next report will fire.
    """
    scheduler = get_scheduler()
    if scheduler is None:
        return {"running": False, "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": next_run.isoformat() if next_run else None,
            "trigger": str(job.trigger),
        })

    return {
        "running": scheduler.running,
        "timezone": os.getenv("REPORT_TIMEZONE", "Asia/Karachi"),
        "report_group_id": os.getenv("REPORT_GROUP_ID") or "(not set)",
        "scheduled_time": f"{os.getenv('REPORT_CRON_HOUR', '20')}:{os.getenv('REPORT_CRON_MINUTE', '00')}",
        "jobs": jobs,
    }
