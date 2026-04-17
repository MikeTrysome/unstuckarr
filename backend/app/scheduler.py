from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings

_scheduler = AsyncIOScheduler()
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cleanup")


async def _run_cleanup_job():
    from app.services.cleanup_service import run_cleanup
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(_executor, run_cleanup, None, "scheduler")


async def start():
    settings = get_settings()
    if not _scheduler.running:
        _scheduler.add_job(
            _run_cleanup_job,
            trigger=IntervalTrigger(minutes=settings.interval_minutes),
            id="cleanup_job",
            replace_existing=True,
        )
        _scheduler.start()


async def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


def get_next_run_time() -> str | None:
    job = _scheduler.get_job("cleanup_job")
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None
