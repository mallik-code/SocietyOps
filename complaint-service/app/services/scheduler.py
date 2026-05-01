"""
Daily report scheduler.

Uses APScheduler (AsyncIOScheduler) to fire a cron job every day at a
configurable hour (default 20:00 / 8 PM) in a configurable timezone
(default Asia/Karachi — adjust via REPORT_TIMEZONE env var).

The job:
  1. Generates the formatted daily report text.
  2. Sends it to the configured WhatsApp group via OpenClaw.

Configuration (env vars):
    REPORT_GROUP_ID    — WhatsApp group ID to send the report to (required)
    REPORT_CRON_HOUR   — Hour to run the job in 24h format (default: 20)
    REPORT_CRON_MINUTE — Minute offset (default: 0)
    REPORT_TIMEZONE    — Timezone for the cron schedule (default: Asia/Karachi)
"""
import logging
import os
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.services.report_generator import format_daily_report_text
from app.services.openclaw_client import get_openclaw_client

logger = logging.getLogger(__name__)

REPORT_GROUP_ID   = os.getenv("REPORT_GROUP_ID", "")
REPORT_CRON_HOUR  = int(os.getenv("REPORT_CRON_HOUR", "20"))
REPORT_CRON_MINUTE = int(os.getenv("REPORT_CRON_MINUTE", "0"))
REPORT_TIMEZONE   = os.getenv("REPORT_TIMEZONE", "Asia/Karachi")


# ─── Scheduled job ─────────────────────────────────────────────────────────────

async def _send_daily_report() -> None:
    """
    Generates today's report text and sends it to the configured group.
    Runs inside a fresh DB session that is always closed afterwards.
    """
    logger.info("Scheduler: running daily report job")

    if not REPORT_GROUP_ID:
        logger.warning(
            "Scheduler: REPORT_GROUP_ID is not set — report generated but not sent"
        )

    db = SessionLocal()
    try:
        report_text = format_daily_report_text(db, report_date=date.today())
    except Exception as exc:
        logger.error("Scheduler: report generation failed — %s", exc)
        return
    finally:
        db.close()

    logger.info("Scheduler: report generated (%d chars)", len(report_text))

    if REPORT_GROUP_ID:
        client = get_openclaw_client()
        sent = await client.send_message(REPORT_GROUP_ID, report_text)
        if sent:
            logger.info("Scheduler: report sent to group %s", REPORT_GROUP_ID)
        else:
            logger.error("Scheduler: failed to send report to group %s", REPORT_GROUP_ID)
    else:
        logger.info("Scheduler: report text (not sent):\n%s", report_text)


# ─── Scheduler lifecycle ───────────────────────────────────────────────────────

_scheduler: AsyncIOScheduler | None = None


def create_scheduler() -> AsyncIOScheduler:
    global _scheduler
    scheduler = AsyncIOScheduler(timezone=REPORT_TIMEZONE)

    trigger = CronTrigger(
        hour=REPORT_CRON_HOUR,
        minute=REPORT_CRON_MINUTE,
        timezone=REPORT_TIMEZONE,
    )
    scheduler.add_job(
        _send_daily_report,
        trigger=trigger,
        id="daily_report",
        name="Daily WhatsApp Report",
        replace_existing=True,
        misfire_grace_time=300,   # allow up to 5 min late start (e.g. after restart)
    )

    logger.info(
        "Scheduler: daily report job scheduled at %02d:%02d %s → group=%s",
        REPORT_CRON_HOUR,
        REPORT_CRON_MINUTE,
        REPORT_TIMEZONE,
        REPORT_GROUP_ID or "(not set — log only)",
    )
    _scheduler = scheduler
    return scheduler


def get_scheduler() -> AsyncIOScheduler | None:
    return _scheduler
