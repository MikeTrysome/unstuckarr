from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_auth
from app.database import get_db
from app.models.ignore import DownloadIgnore
from app.schemas.ignore import IgnoreCreate, IgnoreOut

router = APIRouter(tags=["ignores"], dependencies=[Depends(require_auth)])


def _active_ignores(db: Session) -> list[DownloadIgnore]:
    """All ignores that are still in effect (not expired)."""
    now = datetime.now(timezone.utc)
    return [
        i for i in db.query(DownloadIgnore).all()
        if i.expires_at is None or i.expires_at > now
    ]


@router.get("/ignores", response_model=list[IgnoreOut])
def list_ignores(db: Session = Depends(get_db)):
    return _active_ignores(db)


@router.post("/ignores", response_model=IgnoreOut, status_code=201)
def create_ignore(body: IgnoreCreate, db: Session = Depends(get_db)):
    existing = db.query(DownloadIgnore).filter_by(
        download_hash=body.download_hash
    ).first()
    if existing:
        # Update expiry if already ignored
        existing.expires_at = body.expires_at
        existing.title = body.title
        existing.instance_name = body.instance_name
        db.commit()
        db.refresh(existing)
        return existing

    entry = DownloadIgnore(
        download_hash=body.download_hash,
        instance_name=body.instance_name,
        title=body.title,
        expires_at=body.expires_at,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/ignores/{ignore_id}", status_code=204)
def delete_ignore(ignore_id: int, db: Session = Depends(get_db)):
    entry = db.get(DownloadIgnore, ignore_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Ignore not found")
    db.delete(entry)
    db.commit()
