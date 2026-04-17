"""
Non-secret, runtime-configurable settings stored in the database.
Secrets (API keys, passwords) always come from env vars — never here.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.config import ConfigEntry

DEFAULTS: dict[str, Any] = {
    "detection.infringing_min_age_minutes": 15,
    "detection.canceled_min_age_minutes": 30,
    "detection.min_retry_count": 1,
    "scheduler.dry_run": False,
    "scheduler.enabled": True,
    "notifications.apprise_urls": [],
    # auth.password_hash and auth.jwt_secret have no defaults — absence is meaningful
}


def get(db: Session, key: str) -> Any:
    entry = db.get(ConfigEntry, key)
    if entry is None or entry.value is None:
        return DEFAULTS.get(key)
    try:
        return json.loads(entry.value)
    except Exception:
        return entry.value


def set_(db: Session, key: str, value: Any) -> None:
    entry = db.get(ConfigEntry, key)
    if entry is None:
        entry = ConfigEntry(key=key)
        db.add(entry)
    entry.value = json.dumps(value)
    db.commit()


def get_all(db: Session) -> dict[str, Any]:
    entries = db.query(ConfigEntry).all()
    db_values = {e.key: json.loads(e.value) for e in entries if e.value is not None}
    return {**DEFAULTS, **db_values}


def update_many(db: Session, updates: dict[str, Any]) -> None:
    for key, value in updates.items():
        set_(db, key, value)
