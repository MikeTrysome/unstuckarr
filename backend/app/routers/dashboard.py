from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_auth
from app.database import get_db
from app.models.event import CleanupEvent
from app.models.run import SchedulerRun
from app import scheduler as sched

router = APIRouter(tags=["dashboard"], dependencies=[Depends(require_auth)])


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)

    last_run = (
        db.query(SchedulerRun)
        .filter(SchedulerRun.status != "running")
        .order_by(SchedulerRun.started_at.desc())
        .first()
    )

    events_24h = db.query(CleanupEvent).filter(CleanupEvent.timestamp >= since_24h).all()

    by_instance: dict[str, dict] = {}
    for ev in events_24h:
        inst = ev.instance_name
        if inst not in by_instance:
            by_instance[inst] = {"removed": 0, "dry_run": 0}
        if ev.action == "removed":
            by_instance[inst]["removed"] += 1
        elif ev.action == "dry_run":
            by_instance[inst]["dry_run"] += 1

    total_removed_24h = sum(v["removed"] for v in by_instance.values())
    total_stuck_24h = sum(
        ev.action in ("removed", "dry_run", "error") for ev in events_24h
    )

    return {
        "total_removed_24h": total_removed_24h,
        "total_stuck_24h": total_stuck_24h,
        "by_instance": by_instance,
        "last_run": {
            "run_id": last_run.run_id if last_run else None,
            "started_at": last_run.started_at.isoformat() if last_run else None,
            "status": last_run.status if last_run else None,
            "total_stuck": last_run.total_stuck if last_run else None,
            "total_removed": last_run.total_removed if last_run else None,
            "dry_run": last_run.dry_run if last_run else None,
        },
        "next_run_at": sched.get_next_run_time(),
    }
