from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, field_validator


class UtcModel(BaseModel):
    """Base model that ensures all naive datetimes from SQLite are treated as UTC."""

    @field_validator("*", mode="before")
    @classmethod
    def _coerce_naive_to_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    model_config = {"from_attributes": True}
