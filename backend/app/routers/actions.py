import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_auth

from app.database import get_db
from app.models.run import SchedulerRun
from app.schemas.queue import RunListOut, RunOut

router = APIRouter(prefix="/actions", tags=["actions"], dependencies=[Depends(require_auth)])


def _start_run_in_background(dry_run: bool, triggered_by: str) -> str:
    from app.services.cleanup_service import run_cleanup
    import concurrent.futures

    loop = asyncio.get_event_loop()
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    # We need run_id before the thread starts — generate it here and pass it
    import uuid
    # Actually cleanup_service generates its own run_id, so we run it and return
    future = loop.run_in_executor(executor, run_cleanup, dry_run, triggered_by)
    # We can't await here (sync endpoint) — fire and forget via asyncio
    asyncio.ensure_future(future, loop=loop)

    # Return a placeholder; the actual run_id is written to DB by cleanup_service
    # We return a "queued" response without blocking
    return "queued"


@router.post("/dry-run")
async def trigger_dry_run():
    """Start a dry-run cleanup. Returns immediately."""
    loop = asyncio.get_event_loop()
    from app.services.cleanup_service import run_cleanup
    import concurrent.futures

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = loop.run_in_executor(executor, run_cleanup, True, "manual")
    asyncio.ensure_future(future)

    return {"status": "started", "dry_run": True}


@router.post("/execute")
async def trigger_execute():
    """Start a real cleanup run. Returns immediately."""
    loop = asyncio.get_event_loop()
    from app.services.cleanup_service import run_cleanup
    import concurrent.futures

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = loop.run_in_executor(executor, run_cleanup, False, "manual")
    asyncio.ensure_future(future)

    return {"status": "started", "dry_run": False}


@router.get("/runs", response_model=RunListOut)
def list_runs(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    total = db.query(SchedulerRun).count()
    items = (
        db.query(SchedulerRun)
        .order_by(SchedulerRun.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return RunListOut(
        items=[RunOut.model_validate(r) for r in items],
        total=total,
    )


@router.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(SchedulerRun).filter(SchedulerRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunOut.model_validate(run)
