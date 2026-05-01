"""
Reporting endpoints — daily summaries and aggregations.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import DailyReport
from app.services.report_generator import generate_daily_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily", response_model=DailyReport, summary="Generate a daily complaint report")
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
