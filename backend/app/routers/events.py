from datetime import datetime
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import require_auth

from app.database import get_db
from app.models.event import CleanupEvent
from app.schemas.event import EventListOut, EventOut

router = APIRouter(tags=["events"], dependencies=[Depends(require_auth)])

_VALID_INSTANCES = {"Sonarr", "Sonarr-4K", "Radarr", "Radarr-4K"}
_VALID_ACTIONS = {"removed", "dry_run", "skipped", "error"}


@router.get("/events", response_model=EventListOut)
def list_events(
    instance: str | None = Query(None),
    action: str | None = Query(None),
    from_dt: datetime | None = Query(None, alias="from"),
    to_dt: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    if instance and instance not in _VALID_INSTANCES:
        raise HTTPException(status_code=400, detail=f"Invalid instance. Valid: {sorted(_VALID_INSTANCES)}")
    if action and action not in _VALID_ACTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid action. Valid: {sorted(_VALID_ACTIONS)}")

    q = db.query(CleanupEvent)
    if instance:
        q = q.filter(CleanupEvent.instance_name == instance)
    if action:
        q = q.filter(CleanupEvent.action == action)
    if from_dt:
        q = q.filter(CleanupEvent.timestamp >= from_dt)
    if to_dt:
        q = q.filter(CleanupEvent.timestamp <= to_dt)

    total = q.count()
    items = (
        q.order_by(CleanupEvent.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return EventListOut(
        items=[EventOut.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    event = db.get(CleanupEvent, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return EventOut.model_validate(event)
