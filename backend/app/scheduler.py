from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cleanup")

# Guard flag: prevents queuing a new run while one is already in progress.
# Accessed only from the asyncio event loop thread → no lock needed.
_job_running: bool = False


async def _run_cleanup_job():
    global _job_running
    if _job_running:
        logger.info("Cleanup already running — skipping this scheduled tick.")
        return
    _job_running = True
    try:
        from app.services.cleanup_service import run_cleanup
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, run_cleanup, None, "scheduler")
    finally:
        _job_running = False


async def start():
    if not _scheduler.running:
        from app.database import SessionLocal
        from app.services.db_config import get as db_get
        db = SessionLocal()
        try:
            interval_minutes = db_get(db, "scheduler.interval_minutes")
        finally:
            db.close()
        _scheduler.add_job(
            _run_cleanup_job,
            trigger=IntervalTrigger(minutes=interval_minutes),
            id="cleanup_job",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),
        )
        _scheduler.start()


async def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def reschedule(interval_minutes: int) -> None:
    """Reschedule the cleanup job with a new interval. No-op if scheduler not running."""
    if _scheduler.running:
        _scheduler.reschedule_job(
            "cleanup_job",
            trigger=IntervalTrigger(minutes=max(1, interval_minutes)),
        )


def get_next_run_time() -> str | None:
    job = _scheduler.get_job("cleanup_job")
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None
