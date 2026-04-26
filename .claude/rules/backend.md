---
paths:
  - "backend/**/*.py"
---

# Backend Rules (FastAPI / Python)

## Datetime — Always UTC, Always Aware

```python
# CORRECT
from datetime import datetime, timezone
datetime.now(timezone.utc)

# WRONG — deprecated and naive
datetime.utcnow()
```

### SQLAlchemy DateTime columns — always use `UTCDateTime`

SQLite stores datetimes as naive strings. Plain `DateTime` columns return naive datetimes on read; `isoformat()` then produces strings without timezone info, which browsers interpret as local time — causing timestamps to appear hours off for non-UTC users.

**Every `DateTime` column in a model must use `UTCDateTime` from `app.database`:**

```python
# CORRECT
from app.database import Base, UTCDateTime

class MyModel(Base):
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, default=_utcnow)

# WRONG — returns naive datetime from SQLite
from sqlalchemy import DateTime
created_at: Mapped[datetime] = mapped_column(DateTime, ...)
```

`UTCDateTime` is a `TypeDecorator` that tags naive datetimes as UTC on read. It is a no-op for already-aware datetimes. Define it once in `app/database.py`; import from there in every model.

## Pydantic Response Schemas

All response schemas must inherit from `UtcModel` (in `app/schemas/__init__.py`), not plain `BaseModel`. This ensures timezone tagging and `from_attributes=True` for ORM objects.

```python
from app.schemas import UtcModel

class EventResponse(UtcModel):
    id: int
    timestamp: datetime
    ...
```

## SQLAlchemy Session Lifecycle

```python
db = SessionLocal()
try:
    # do work, db.commit() after each logical unit
    ...
except Exception as exc:
    try:
        db.rollback()
    except Exception:
        pass
    # attempt recovery write here
    raise
finally:
    db.close()
```

Never use `async` with SQLAlchemy in this project. The engine uses `check_same_thread=False` for SQLite.

## cleanup_service.run_cleanup()

This function is **synchronous and blocking**. Never call it from an async context directly:

```python
# CORRECT — via executor
loop = asyncio.get_event_loop()
await loop.run_in_executor(_executor, run_cleanup, None, "scheduler")

# WRONG — blocks event loop
await run_cleanup()
run_cleanup()
```

## detection.py — Stay Pure

`detection.py` must remain side-effect-free. No logging calls, no DB access, no HTTP calls. If you add detection logic, use only pure Python: comparisons, datetime arithmetic, list comprehensions.

## Logging

Use Python's `logging` module in all modules except `cleanup_service.py` and `detection.py`. In cleanup_service, use `_log()` which routes to the WebSocket broadcaster.

All log messages must be in **English**.

## Error Handling in Per-Item Loops

When iterating over items in a cleanup loop, wrap each item's operations individually:

```python
for item in items:
    try:
        # per-item work
        ...
    except Exception as exc:
        _log("ERROR", f"Item failed: {exc}", run_id=run_id)
        continue  # always continue to next item
```

Never let a single item failure abort the entire run.

## New Endpoints

- Follow the existing router pattern (`app/routers/`)
- Use `Depends(get_db)` for DB sessions in router endpoints
- Use `Depends(get_current_user)` for authenticated endpoints
- Return Pydantic schemas, not raw SQLAlchemy objects
- 200 for success, 400 for bad input, 404 for not found, 500 for server errors
